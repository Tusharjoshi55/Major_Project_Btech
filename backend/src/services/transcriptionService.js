const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const openai = require('../config/openai');

const CHUNK_DURATION = 60;  // seconds per chunk for long audio

/**
 * Transcribes MP3 or MP4 using Whisper API.
 * For MP4: extracts audio track first using FFmpeg.
 * Returns: [{ start: 0.0, end: 3.2, text: "Hello world" }]
 */
const transcribe = async (filePath, fileType) => {
  let audioPath = filePath;

  // Extract audio from video
  if (fileType === 'mp4') {
    audioPath = filePath.replace('.mp4', '_audio.mp3');
    execSync(`ffmpeg -i "${filePath}" -q:a 0 -map a "${audioPath}" -y`);
  }

  const audioStream = fs.createReadStream(audioPath);

  const response = await openai.audio.transcriptions.create({
    file: audioStream,
    model: 'whisper-1',
    response_format: 'verbose_json',  // gives us timestamps
    timestamp_granularities: ['segment'],
  });

  // Clean up extracted audio
  if (fileType === 'mp4' && fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath);
  }

  // Map Whisper segments to our format
  return (response.segments || []).map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }));
};

/**
 * Groups transcript segments into chunks (~500 words).
 * Returns: [{ content, timestamp_start, timestamp_end, chunk_index }]
 */
const buildChunks = (transcript, sourceId) => {
  const chunks = [];
  let current = [];
  let wordCount = 0;
  let chunkIndex = 0;
  const WORDS_PER_CHUNK = 400;

  for (const seg of transcript) {
    current.push(seg);
    wordCount += seg.text.split(/\s+/).length;

    if (wordCount >= WORDS_PER_CHUNK) {
      chunks.push({
        content: current.map((s) => s.text).join(' '),
        timestamp_start: current[0].start,
        timestamp_end: current.at(-1).end,
        page_number: null,
        chunk_index: chunkIndex++,
      });
      // overlap: keep last 2 segments
      current = current.slice(-2);
      wordCount = current.reduce((acc, s) => acc + s.text.split(/\s+/).length, 0);
    }
  }

  // Push remaining
  if (current.length) {
    chunks.push({
      content: current.map((s) => s.text).join(' '),
      timestamp_start: current[0].start,
      timestamp_end: current.at(-1).end,
      page_number: null,
      chunk_index: chunkIndex,
    });
  }

  return chunks;
};

module.exports = { transcribe, buildChunks };