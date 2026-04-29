import fs from 'fs';
import pool from '../config/db.js';
import * as pdfService from './pdfService.js';
import * as transcriptionService from './transcriptionService.js';
import * as embeddingService from './embeddingService.js';
import openai from '../config/openai.js';

/**
 * Master pipeline called after a file is saved to Supabase Storage.
 * Detects file type → extracts text/transcript → chunks → embeds → stores
 * Advanced: Creates summaries for long documents
 *
 * Runs entirely in background (non-blocking from controller).
 *
 * @param {string} sourceId   — DB UUID of the source row
 * @param {string} fileUrl    — signed Supabase Storage URL
 * @param {string} fileType   — 'pdf' | 'mp3' | 'mp4'
 * @param {string} localPath  — temp file path on disk (from multer)
 */
export const processSource = async (sourceId, fileUrl, fileType, localPath) => {
  try {
    console.log(`\n⚙️  Processing source ${sourceId} (${fileType})...`);

    // Mark as processing
    await pool.query(
      `UPDATE sources SET status='processing', updated_at=NOW() WHERE id=$1`,
      [sourceId]
    );

    let chunks = [];

    // ── PDF ────────────────────────────────────────────────────────
    if (fileType === 'pdf') {
      try {
        console.log(`  📄 Extracting PDF pages...`);
        const pages = await pdfService.extractPages(localPath);

        await pool.query(
          `UPDATE sources SET metadata=$1 WHERE id=$2`,
          [JSON.stringify({ pages, total_pages: pages.length }), sourceId]
        );

        console.log(`  ✂️  Building ${pages.length}-page PDF chunks...`);
        chunks = pdfService.buildChunks(pages);
      } catch (pdfErr) {
        throw new Error(`PDF Processing failed: ${pdfErr.message}`);
      }

      // ── Audio / Video ─────────────────────────────────────────────
    } else if (fileType === 'mp3' || fileType === 'mp4') {
      try {
        console.log(`  🎙️  Transcribing ${fileType.toUpperCase()} with Whisper...`);
        const transcript = await transcriptionService.transcribe(localPath, fileType);

        await pool.query(
          `UPDATE sources SET metadata=$1 WHERE id=$2`,
          [
            JSON.stringify({
              transcript,
              duration: transcript.at(-1)?.end ?? 0,
              segment_count: transcript.length,
            }),
            sourceId,
          ]
        );

        console.log(`  ✂️  Building transcript chunks (${transcript.length} segments)...`);
        chunks = transcriptionService.buildChunks(transcript);
      } catch (audioErr) {
        throw new Error(`Audio/Video transcription failed: ${audioErr.message}`);
      }
    }

    // ── Embedding ─────────────────────────────────────────────────
    if (chunks.length === 0) {
      throw new Error('No content could be extracted from this file.');
    }

    // Get notebookId for chunk rows
    const { rows } = await pool.query(
      `SELECT notebook_id FROM sources WHERE id=$1`,
      [sourceId]
    );
    const notebookId = rows[0].notebook_id;

    console.log(`  🧠 Embedding ${chunks.length} chunks...`);
    try {
      await embeddingService.embedAndStore(chunks, sourceId, notebookId);
    } catch (embedErr) {
      throw new Error(`Embedding generation failed: ${embedErr.message}`);
    }

    // ── Advanced: Create semantic summaries for long documents ────
    if (chunks.length > 20) {
      console.log(`  📝 Creating semantic summary for long document...`);
      await createDocumentSummary(sourceId, chunks);
    }

    // Mark as ready
    await pool.query(
      `UPDATE sources SET status='ready', updated_at=NOW() WHERE id=$1`,
      [sourceId]
    );

    // ── Auto-Generate Overview Note ──
    try {
      console.log(`  📝 Generating automatic overview note...`);
      const sampleText = chunks.slice(0, 3).map(c => c.content).join('\\n\\n');
      const overview = await openai.chat.completions.create({
        model: 'google/gemini-2.0-flash-lite-001',
        messages: [
          { role: 'system', content: 'You are an AI assistant. Summarize the following text into a neat, short study guide with bullet points. It is the beginning of a document.' },
          { role: 'user', content: sampleText }
        ],
        max_tokens: 300
      });
      const noteContent = overview.choices[0]?.message?.content || 'No summary generated.';
      
      const { rows: sourceInfo } = await pool.query(`SELECT title FROM sources WHERE id=$1`, [sourceId]);
      const title = `Overview: ${sourceInfo[0]?.title}`;

      await pool.query(
        `INSERT INTO notes (notebook_id, title, content) VALUES ($1, $2, $3)`,
        [notebookId, title, noteContent]
      );
      console.log(`  ✅ Overview Note created.`);
    } catch (e) {
      console.error(`  ❌ Failed to generate auto-overview note:`, e.message);
    }

    console.log(`  ✅ Source ${sourceId} ready — ${chunks.length} chunks embedded.\n`);

  } catch (err) {
    console.error(`  ❌ Source ${sourceId} failed: ${err.message}`);
    await pool.query(
      `UPDATE sources SET status='error', error_message=$1, updated_at=NOW() WHERE id=$2`,
      [err.message, sourceId]
    );
  } finally {
    // Always clean up temp file
    if (localPath && fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }
};

/**
 * Create a semantic summary for long documents using GPT
 * @param {string} sourceId
 * @param {Array} chunks
 */
const createDocumentSummary = async (sourceId, chunks) => {
  console.log(`📝 Creating semantic summary for long document (${chunks.length} chunks)`);

  try {
    // Group chunks into sections for summarization
    const sectionSize = 10;
    const summaries = [];

    for (let i = 0; i < chunks.length; i += sectionSize) {
      const section = chunks.slice(i, i + sectionSize);
      const sectionText = section.map(c => c.content).join('\n\n');

      const summary = await openai.chat.completions.create({
        model: 'google/gemini-2.0-flash-lite-001',
        messages: [
          { role: 'system', content: 'Summarize this section in 3-5 key points' },
          { role: 'user', content: sectionText }
        ],
        max_tokens: 200
      });

      summaries.push({
        section_start: section[0]?.chunk_index,
        section_end: section[section.length - 1]?.chunk_index,
        summary: summary.choices[0]?.message?.content || ''
      });
    }

    // Store summary in metadata
    await pool.query(
      `UPDATE sources SET metadata = jsonb_set(metadata, '{summaries}', to_jsonb($1)) WHERE id = $2`,
      [summaries, sourceId]
    );

    console.log(`✅ Created ${summaries.length} summary sections`);
  } catch (err) {
    console.warn('⚠️  Summary generation failed:', err.message);
  }
};

/**
 * Create a timeline summary for long transcripts
 * @param {string} sourceId
 * @param {Array} chunks
 */
const createTimelineSummary = async (sourceId, chunks) => {
  console.log(`📝 Creating timeline summary for long transcript (${chunks.length} chunks)`);

  try {
    // Extract key moments based on timestamps
    const keyMoments = [];
    const interval = Math.ceil(chunks.length / 5); // 5 key moments

    for (let i = 0; i < chunks.length; i += interval) {
      const chunk = chunks[i];
      const summary = await openai.chat.completions.create({
        model: 'google/gemini-2.0-flash-lite-001',
        messages: [
          { role: 'system', content: 'Extract the key topic or event from this transcript segment' },
          { role: 'user', content: `${chunk.content} (at ${chunk.timestamp_start}s)` }
        ],
        max_tokens: 150
      });

      keyMoments.push({
        timestamp: chunk.timestamp_start,
        summary: summary.choices[0]?.message?.content || '',
        chunk_index: chunk.chunk_index
      });
    }

    // Store timeline in metadata
    await pool.query(
      `UPDATE sources SET metadata = jsonb_set(metadata, '{timeline}', to_jsonb($1)) WHERE id = $2`,
      [keyMoments, sourceId]
    );

    console.log(`✅ Created ${keyMoments.length} key timeline moments`);
  } catch (err) {
    console.warn('⚠️  Timeline generation failed:', err.message);
  }
};
