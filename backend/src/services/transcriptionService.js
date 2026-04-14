import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import openai from '../config/openai.js';

const WORDS_PER_CHUNK = 400;
const MAX_FILE_SIZE = 24 * 1024 * 1024; // 24 MB — Whisper API limit

/**
 * Transcribes MP3 or MP4 using OpenAI Whisper.
 * For MP4: strips audio track first with FFmpeg.
 *
 * @param {string} filePath  — local temp file path
 * @param {string} fileType  — 'mp3' | 'mp4'
 * @returns {Array<{start: number, end: number, text: string}>}
 */
export const transcribe = async (filePath, fileType) => {
  let audioPath = filePath;
  let didExtract = false;

  try {
    // Extract audio track from video
    if (fileType === 'mp4') {
      audioPath = path.join(os.tmpdir(), `${Date.now()}_audio.mp3`);
      didExtract = true;
      execSync(
        `ffmpeg -i "${filePath}" -vn -acodec libmp3lame -q:a 2 "${audioPath}" -y`,
        { stdio: 'pipe' }
      );
    }

    // Check file size — Whisper API has 25 MB limit
    const { size } = fs.statSync(audioPath);
    if (size > MAX_FILE_SIZE) {
      throw new Error(`Audio file too large (${(size / 1024 / 1024).toFixed(1)} MB). Max 24 MB.`);
    }

    const audioStream = fs.createReadStream(audioPath);

    const response = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    return (response.segments || []).map(seg => ({
      start: parseFloat(seg.start.toFixed(2)),
      end: parseFloat(seg.end.toFixed(2)),
      text: seg.text.trim(),
    }));

  } finally {
    // Clean up extracted audio file
    if (didExtract && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
  }
};

/**
 * Groups transcript segments into overlapping text chunks.
 * @param {Array<{start,end,text}>} transcript
 * @returns {Array<{content, timestamp_start, timestamp_end, page_number, chunk_index}>}
 */
export const buildChunks = (transcript) => {
  const chunks = [];
  let current = [];
  let wordCount = 0;
  let chunkIndex = 0;

  for (const seg of transcript) {
    current.push(seg);
    wordCount += seg.text.split(/\s+/).length;

    if (wordCount >= WORDS_PER_CHUNK) {
      chunks.push({
        content: current.map(s => s.text).join(' '),
        timestamp_start: current[0].start,
        timestamp_end: current.at(-1).end,
        page_number: null,
        chunk_index: chunkIndex++,
      });
      // Keep last 2 segments as overlap
      current = current.slice(-2);
      wordCount = current.reduce((acc, s) => acc + s.text.split(/\s+/).length, 0);
    }
  }

  // Flush remaining segments
  if (current.length) {
    chunks.push({
      content: current.map(s => s.text).join(' '),
      timestamp_start: current[0].start,
      timestamp_end: current.at(-1).end,
      page_number: null,
      chunk_index: chunkIndex,
    });
  }

  return chunks;
};
