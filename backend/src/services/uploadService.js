const pdfService = require('./pdfService');
const transcriptionService = require('./transcriptionService');
const embeddingService = require('./embeddingService');
const pool = require('../config/db');

/**
 * Main entry point called after a file is saved to Firebase Storage.
 * Detects file type, extracts text/transcript, and queues for embedding.
 *
 * @param {string} sourceId     - UUID of the source row in DB
 * @param {string} fileUrl      - Public Firebase Storage URL
 * @param {string} fileType     - 'pdf' | 'mp3' | 'mp4'
 * @param {string} localPath    - Temp path on server (for FFmpeg)
 */
const processSource = async (sourceId, fileUrl, fileType, localPath) => {
  try {
    // Mark as processing
    await pool.query(
      `UPDATE sources SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [sourceId]
    );

    let chunks = [];

    if (fileType === 'pdf') {
      // Extract text page by page
      const pages = await pdfService.extractPages(localPath);
      // Save raw metadata
      await pool.query(
        `UPDATE sources SET metadata = $1 WHERE id = $2`,
        [JSON.stringify({ pages, total_pages: pages.length }), sourceId]
      );
      // Build chunks from pages
      chunks = pdfService.buildChunks(pages, sourceId);

    } else if (fileType === 'mp3' || fileType === 'mp4') {
      // Extract audio track (for mp4) then transcribe
      const transcript = await transcriptionService.transcribe(localPath, fileType);
      await pool.query(
        `UPDATE sources SET metadata = $1 WHERE id = $2`,
        [JSON.stringify({ transcript, duration: transcript.at(-1)?.end || 0 }), sourceId]
      );
      // Build chunks from transcript segments
      chunks = transcriptionService.buildChunks(transcript, sourceId);
    }

    // Generate embeddings and store in chunks table
    const source = await pool.query(
      `SELECT notebook_id FROM sources WHERE id = $1`, [sourceId]
    );
    const notebookId = source.rows[0].notebook_id;

    await embeddingService.embedAndStore(chunks, sourceId, notebookId);

    // Mark as ready
    await pool.query(
      `UPDATE sources SET status = 'ready', updated_at = NOW() WHERE id = $1`,
      [sourceId]
    );

    console.log(`✅ Source ${sourceId} processed successfully`);
  } catch (err) {
    console.error(`❌ Source ${sourceId} processing failed:`, err.message);
    await pool.query(
      `UPDATE sources SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message, sourceId]
    );
  }
};

module.exports = { processSource };