import openai, { openaiEmbeddings } from '../config/openai.js';
import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 20; // embed N chunks per API call
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

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

  const totalChunks = chunks.length;
  let embeddedCount = 0;

  for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.content);

    // Retry logic for API calls
    let response;
    let retryCount = 0;
    while (retryCount < MAX_RETRIES) {
      try {
        response = await openaiEmbeddings.embeddings.create({
          model: EMBEDDING_MODEL,
          input: texts,
        });
        break; // Success
      } catch (error) {
        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          console.error(`❌ Failed to embed batch starting at ${i} after ${MAX_RETRIES} retries:`, error.message);
          throw error;
        }
        console.warn(`⚠️  Retry ${retryCount}/${MAX_RETRIES} for batch ${Math.floor(i / BATCH_SIZE) + 1}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
      }
    }

    // Insert each chunk with its embedding
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embedding = response.data[j]?.embedding;

      if (!embedding) {
        console.warn(`⚠️  No embedding for chunk at index ${i + j}`);
        continue;
      }

      // Generate unique ID for chunk tracking
      const chunkId = uuidv4();

      await pool.query(
        `INSERT INTO chunks
           (id, source_id, notebook_id, chunk_index, content,
            page_number, timestamp_start, timestamp_end, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)`,
        [
          chunkId,
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

      embeddedCount++;
    }

    console.log(`  ✅ Embedded ${embeddedCount}/${totalChunks} chunks`);
  }

  console.log(`  ✅ Completed embedding for source ${sourceId}`);
};

/**
 * Generate embeddings for a single text input
 * @param {string} text
 * @returns {Promise<number[]>} embedding vector
 */
export const embedText = async (text) => {
  const response = await openaiEmbeddings.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
};
