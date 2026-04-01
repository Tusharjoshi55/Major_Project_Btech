const openai = require('../config/openai');
const pool = require('../config/db');

/**
 * Given a user query and notebookId:
 * 1. Embeds the query
 * 2. Finds top-K similar chunks via pgvector cosine similarity
 * 3. Returns chunks with citation metadata
 */
const retrieve = async (query, notebookId, topK = 6) => {
  const embResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const queryEmbedding = embResponse.data[0].embedding;

  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.content,
       c.page_number,
       c.timestamp_start,
       c.timestamp_end,
       s.title AS source_title,
       s.id    AS source_id,
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
 * Builds the system prompt with retrieved context and citation markers.
 */
const buildGroundedPrompt = (retrievedChunks) => {
  const contextBlocks = retrievedChunks.map((chunk, i) => {
    const citationLabel = chunk.file_type === 'pdf'
      ? `[Source: ${chunk.source_title}, Page ${chunk.page_number}]`
      : `[Source: ${chunk.source_title} @ ${formatTime(chunk.timestamp_start)}]`;

    return `Context ${i + 1} ${citationLabel}:\n${chunk.content}`;
  });

  return `You are a helpful research assistant. Answer the user's question using ONLY the context provided below.
For every claim you make, cite the source using the exact label shown (e.g. [Source: File.pdf, Page 3]).
If the answer is not found in the context, say "I don't have enough information in the provided sources."

${contextBlocks.join('\n\n---\n\n')}`;
};

const formatTime = (seconds) => {
  if (seconds == null) return '?';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

module.exports = { retrieve, buildGroundedPrompt };