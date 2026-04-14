import openai from '../config/openai.js';
import pool from '../config/db.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 20; // embed N chunks per API call

/**
 * Generates OpenAI embeddings for all chunks and bulk-inserts into DB.
 *
 * @param {Array}  chunks      — from pdfService.buildChunks or transcriptionService.buildChunks
 * @param {string} sourceId    — UUID
 * @param {string} notebookId  — UUID
 */
export const embedAndStore = async (chunks, sourceId, notebookId) => {
  if (!chunks.length) {
    console.warn(`embedAndStore: no chunks to embed for source ${sourceId}`);
    return;
  }

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.content);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    // Insert each chunk with its embedding
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embedding = response.data[j].embedding;

      await pool.query(
        `INSERT INTO chunks
           (source_id, notebook_id, chunk_index, content,
            page_number, timestamp_start, timestamp_end, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)`,
        [
          sourceId,
          notebookId,
          chunk.chunk_index,
          chunk.content,
          chunk.page_number ?? null,
          chunk.timestamp_start ?? null,
          chunk.timestamp_end ?? null,
          JSON.stringify(embedding),
        ]
      );
    }

    console.log(`  ✅ Embedded chunks ${i}–${i + batch.length - 1} of ${chunks.length}`);
  }
};
