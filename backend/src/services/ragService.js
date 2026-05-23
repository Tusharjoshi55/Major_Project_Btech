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
 * Builds a grounded system prompt injecting retrieved context and web search context.
 *
 * @param {Array} retrievedChunks — from retrieve()
 * @param {Array} webResults — from webSearchService.search()
 * @returns {string} system prompt
 */
export const buildGroundedPrompt = (retrievedChunks = [], webResults = []) => {
  const contextBlocks = [];
  if (retrievedChunks && retrievedChunks.length > 0) {
    retrievedChunks.forEach((chunk, i) => {
      const label = chunk.file_type === 'pdf'
        ? `[Source ${i + 1}: "${chunk.source_title}", Page ${chunk.page_number ?? '?'}]`
        : `[Source ${i + 1}: "${chunk.source_title}" @ ${formatTimestamp(chunk.timestamp_start)}]`;

      contextBlocks.push(`${label}\n${chunk.content}`);
    });
  }

  const webBlocks = [];
  if (webResults && webResults.length > 0) {
    webResults.forEach((result, i) => {
      const label = `[Web Source ${i + 1}: "${result.title}", URL: ${result.url}]`;
      webBlocks.push(`${label}\n${result.snippet}`);
    });
  }

  if (contextBlocks.length === 0 && webBlocks.length === 0) {
    return `You are a helpful research assistant. 
No relevant local source content or web search results were found for this query. 
Tell the user you couldn't find relevant information in their uploaded sources or on the web.`;
  }

  let instructionText = `You are a helpful research assistant with access to the user's uploaded sources and real-time web search capability.`;

  if (contextBlocks.length > 0 && webBlocks.length > 0) {
    instructionText += `

INSTRUCTIONS:
1. Answer the user's question using the provided Local Sources first.
2. If the local sources do not contain sufficient detail or are missing requested facts, use the provided Web Search Results to enhance and complete the answer.
3. Cite claims from local sources using the exact label (e.g. [Source 1: "filename.pdf", Page 3]).
4. Cite claims from web search using the exact web source label (e.g. [Web Source 1: "Title", URL: http://...]).
5. Clearly distinguish between local source information and web search information where appropriate.
6. Use markdown formatting.`;
  } else if (contextBlocks.length > 0) {
    instructionText += `

INSTRUCTIONS:
1. Answer using ONLY the Local Sources provided below.
2. Cite every claim using the exact source label shown (e.g. [Source 1: "filename.pdf", Page 3]).
3. If multiple sources support a claim, cite all of them.
4. If the answer is not in the context, say: "I couldn't find that information in your sources."
5. Be concise but thorough. Use markdown formatting.`;
  } else {
    instructionText += `

INSTRUCTIONS:
1. We could not find any relevant information in the user's uploaded documents.
2. Answer the query thoroughly using the provided real-time Web Search Results.
3. Cite claims from web search using the exact web source label (e.g. [Web Source 1: "Title", URL: http://...]).
4. Politely mention to the user that you couldn't find this information in their uploaded documents, but found it via real-time web search.
5. Use markdown formatting.`;
  }

  let prompt = instructionText;

  if (contextBlocks.length > 0) {
    prompt += `

LOCAL SOURCES:
${contextBlocks.join('\n\n---\n\n')}`;
  }

  if (webBlocks.length > 0) {
    prompt += `

WEB SEARCH RESULTS (REAL-TIME):
${webBlocks.join('\n\n---\n\n')}`;
  }

  return prompt;
};

// ─── Helpers ─────────────────────────────────────────────────────────

const formatTimestamp = (seconds) => {
  if (seconds == null) return '??:??';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
