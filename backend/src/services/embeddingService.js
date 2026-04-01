const openai = require('../config/openai');
const pool = require('../config/db');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 20; // embed 20 chunks at a time

/**
 * Generates embeddings for all chunks and inserts into DB.
 */
const embedAndStore = async (chunks, sourceId, notebookId) => {
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    const values = batch.map((chunk, j) => ({
      ...chunk,
      embedding: response.data[j].embedding,
    }));

    // Bulk insert
    for (const v of values) {
      await pool.query(
        `INSERT INTO chunks
           (source_id, notebook_id, chunk_index, content,
            page_number, timestamp_start, timestamp_end, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sourceId,
          notebookId,
          v.chunk_index,
          v.content,
          v.page_number,
          v.timestamp_start,
          v.timestamp_end,
          JSON.stringify(v.embedding),
        ]
      );
    }

    console.log(`  Embedded chunks ${i}–${i + batch.length - 1}`);
  }
};

module.exports = { embedAndStore };