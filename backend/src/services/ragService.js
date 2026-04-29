import openai from '../config/openai.js';
import pool from '../config/db.js';

const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

/**
 * Embeds a query and retrieves the top-K most similar chunks
 * from a given notebook using pgvector cosine similarity.
 *
 * @param {string} query
 * @param {string} notebookId
 * @param {number} topK
 * @returns {Array} chunks with citation metadata
 */
export const retrieve = async (query, notebookId, topK = 6) => {
  let queryEmbedding;
  try {
    const embResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
      encoding_format: 'float',
    });

    if (!embResponse.data || !embResponse.data[0]) {
      console.error("OpenRouter Embedding Error:", embResponse);
      throw new Error("Failed to generate embeddings from OpenRouter: No data returned.");
    }
    
    queryEmbedding = embResponse.data[0].embedding;
  } catch (error) {
    console.error("Embedding Retrieval Error:", error.message || error);
    throw new Error("RAG Embedding Error");
  }

  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.content,
       c.page_number,
       c.timestamp_start,
       c.timestamp_end,
       c.chunk_index,
       s.title    AS source_title,
       s.id       AS source_id,
       s.file_type,
       1 - (c.embedding <=> $1::vector) AS similarity
     FROM chunks c
     JOIN sources s ON c.source_id = s.id
     WHERE c.notebook_id = $2
       AND s.status = 'ready'
     ORDER BY c.embedding <=> $1::vector
     LIMIT $3`,
    [JSON.stringify(queryEmbedding), notebookId, topK]
  );

  return rows;
};

/**
 * Builds a grounded system prompt injecting retrieved context
 * with citation labels for each chunk.
 *
 * @param {Array} retrievedChunks — from retrieve()
 * @returns {string} system prompt
 */
export const buildGroundedPrompt = (retrievedChunks) => {
  if (!retrievedChunks.length) {
    return `You are a helpful research assistant. 
No relevant source content was found for this query. 
Tell the user you couldn't find relevant information in their uploaded sources.`;
  }

  const contextBlocks = retrievedChunks.map((chunk, i) => {
    const label = chunk.file_type === 'pdf'
      ? `[Source ${i + 1}: "${chunk.source_title}", Page ${chunk.page_number ?? '?'}]`
      : `[Source ${i + 1}: "${chunk.source_title}" @ ${formatTimestamp(chunk.timestamp_start)}]`;

    return `${label}\n${chunk.content}`;
  });

  return `You are a helpful research assistant with access to the user's uploaded sources.

INSTRUCTIONS:
1. Answer using ONLY the context provided below.
2. Cite every claim using the exact source label shown (e.g. [Source 1: "filename.pdf", Page 3]).
3. If multiple sources support a claim, cite all of them.
4. If the answer is not in the context, say: "I couldn't find that information in your sources."
5. Be concise but thorough. Use markdown formatting.

SOURCES:
${contextBlocks.join('\n\n---\n\n')}`;
};

// ─── Helpers ─────────────────────────────────────────────────────────

const formatTimestamp = (seconds) => {
  if (seconds == null) return '??:??';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
