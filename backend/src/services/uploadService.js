import fs from 'fs';
import pool from '../config/db.js';
import * as pdfService from './pdfService.js';
import * as transcriptionService from './transcriptionService.js';
import * as embeddingService from './embeddingService.js';

/**
 * Master pipeline called after a file is saved to Firebase Storage.
 * Detects file type → extracts text/transcript → chunks → embeds → stores.
 *
 * Runs entirely in background (non-blocking from controller).
 *
 * @param {string} sourceId   — DB UUID of the source row
 * @param {string} fileUrl    — signed Firebase Storage URL
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
      console.log(`  📄 Extracting PDF pages...`);
      const pages = await pdfService.extractPages(localPath);

      await pool.query(
        `UPDATE sources SET metadata=$1 WHERE id=$2`,
        [JSON.stringify({ pages, total_pages: pages.length }), sourceId]
      );

      console.log(`  ✂️  Building ${pages.length}-page PDF chunks...`);
      chunks = pdfService.buildChunks(pages);

      // ── Audio / Video ─────────────────────────────────────────────
    } else if (fileType === 'mp3' || fileType === 'mp4') {
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
    await embeddingService.embedAndStore(chunks, sourceId, notebookId);

    // Mark as ready
    await pool.query(
      `UPDATE sources SET status='ready', updated_at=NOW() WHERE id=$1`,
      [sourceId]
    );

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
