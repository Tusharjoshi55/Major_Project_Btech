import openai from '../config/openai.js';
import pool from '../config/db.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';

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
  const embResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
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



// import openai from '../config/openai.js';
// import pool from '../config/db.js';

// const EMBEDDING_MODEL = 'text-embedding-3-small';
// const RERANKING_MODEL = 'text-ranking-001'; // For advanced re-ranking

// /**
//  * Multi-stage retrieval: coarse (vector) + fine (re-ranking)
//  * from a given notebook using pgvector cosine similarity.
//  *
//  * @param {string} query
//  * @param {string} notebookId
//  * @param {number} topK - Initial retrieval count
//  * @param {number} rerankK - Final results after re-ranking
//  * @returns {Array} chunks with citation metadata and rerank scores
//  */
// export const retrieve = async (query, notebookId, topK = 10, rerankK = 6) => {
//   // Stage 1: Coarse retrieval using vector similarity
//   const embResponse = await openai.embeddings.create({
//     model: EMBEDDING_MODEL,
//     input: query,
//   });
//   const queryEmbedding = embResponse.data[0].embedding;

//   const { rows: coarseResults } = await pool.query(
//     `SELECT
//        c.id,
//        c.content,
//        c.page_number,
//        c.timestamp_start,
//        c.timestamp_end,
//        c.chunk_index,
//        s.title    AS source_title,
//        s.id       AS source_id,
//        s.file_type,
//        1 - (c.embedding <=> $1::vector) AS vector_sim
//      FROM chunks c
//      JOIN sources s ON c.source_id = s.id
//      WHERE c.notebook_id = $2
//        AND s.status = 'ready'
//      ORDER BY c.embedding <=> $1::vector
//      LIMIT $3`,
//     [JSON.stringify(queryEmbedding), notebookId, topK]
//   );

//   if (!coarseResults.length) return [];

//   // Stage 2: Advanced re-ranking using OpenAI reranking
//   try {
//     const rerankResponse = await openai.axios.post('/v1/files', {
//       // Note: Re-ranking would require separate API setup
//       // For now, we'll use a hybrid approach with metadata scoring
//     });

//     // Fallback: Use metadata-based boosting for re-ranking
//     const rerankedResults = coarseResults.map(chunk => {
//       // Boost score based on metadata relevance
//       let boost = 1.0;

//       // Prefer PDF sources for factual queries
//       if (chunk.file_type === 'pdf' && (query.toLowerCase().includes('definition') || query.toLowerCase().includes('fact'))) {
//         boost *= 1.1;
//       }

//       // Prefer audio transcripts for temporal queries
//       if (chunk.file_type === 'mp3' && (query.toLowerCase().includes('time') || query.toLowerCase().includes('during'))) {
//         boost *= 1.15;
//       }

//       // Prefer video for visual/demonstration queries
//       if (chunk.file_type === 'mp4' && (query.toLowerCase().includes('show') || query.toLowerCase().includes('demonstrate'))) {
//         boost *= 1.1;
//       }

//       return {
//         ...chunk,
//         rerank_score: chunk.vector_sim * boost,
//         boost_reason: boost > 1 ? `Boosted for ${chunk.file_type}` : 'No boost'
//       };
//     });

//     // Sort by rerank score and limit
//     return rerankedResults
//       .sort((a, b) => b.rerank_score - a.rerank_score)
//       .slice(0, rerankK);
//   } catch (rerankError) {
//     console.warn('Reranking failed, using coarse results:', rerankError.message);
//     return coarseResults.slice(0, rerankK);
//   }
// };

// /**
//  * Query expansion with synonyms and related terms
//  * @param {string} query
//  * @returns {string} expanded query
//  */
// export const expandQuery = (query) => {
//   // Basic synonym expansion (in production, use a thesaurus or LLM)
//   const expansions = {
//     'definition': ['definition', 'meaning', 'what is'],
//     'example': ['example', 'sample', 'illustration'],
//     'cause': ['cause', 'reason', 'why'],
//     'effect': ['effect', 'result', 'consequence'],
//     'process': ['process', 'procedure', 'method'],
//     'benefit': ['benefit', 'advantage', 'pros'],
//   };

//   const words = query.toLowerCase().split(' ');
//   const expandedTerms = words.map(word => expansions[word] || [word]);

//   // Return expanded query with OR logic
//   return expandedTerms.map(terms => `(${terms.join(' OR ')})`).join(' AND ');
// };

// /**
//  * Builds a grounded system prompt injecting retrieved context
//  * with citation labels for each chunk.
//  *
//  * @param {Array} retrievedChunks — from retrieve()
//  * @returns {string} system prompt
//  */
// export const buildGroundedPrompt = (retrievedChunks) => {
//   if (!retrievedChunks.length) {
//     return `You are a helpful research assistant.
// No relevant source content was found for this query.
// Tell the user you couldn't find relevant information in their uploaded sources.`;
//   }

//   const contextBlocks = retrievedChunks.map((chunk, i) => {
//     const label = chunk.file_type === 'pdf'
//       ? `[Source ${i + 1}: "${chunk.source_title}", Page ${chunk.page_number ?? '?'}]`
//       : `[Source ${i + 1}: "${chunk.source_title}" @ ${formatTimestamp(chunk.timestamp_start)}]`;

//     return `${label}\n${chunk.content}`;
//   });

//   return `You are a helpful research assistant with access to the user's uploaded sources.

// INSTRUCTIONS:
// 1. Answer using ONLY the context provided below.
// 2. Cite every claim using the exact source label shown (e.g. [Source 1: "filename.pdf", Page 3]).
// 3. If multiple sources support a claim, cite all of them.
// 4. If the answer is not in the context, say: "I couldn't find that information in your sources."
// 5. Be concise but thorough. Use markdown formatting.
// 6. If uncertain about an answer, say so rather than hallucinating.

// SOURCES:
// ${contextBlocks.join('\n\n---\n\n')}`;
// };

// // ─── Streaming Response Helper ───────────────────────────────────────────────

// /**
//  * Formats a citation array for streaming display
//  * @param {Array} citations
//  * @returns {string} formatted citation string
//  */
// export const formatCitations = (citations) => {
//   if (!citations || citations.length === 0) return '';
//   return citations.map((c, i) => {
//     const page = c.page_number !== undefined ? `, Page ${c.page_number}` : '';
//     const time = c.timestamp_start !== undefined ? ` @ ${formatTimestamp(c.timestamp_start)}` : '';
//     return `[${i + 1}: ${c.title}${page}${time}]`;
//   }).join(', ');
// };

// /**
//  * Validates if answer is grounded in provided sources
//  * @param {string} answer - Model's generated answer
//  * @param {Array} citations - Citations from the model
//  * @returns {{isGrounded: boolean, reason: string}}
//  */
// export const validateAnswerGrounding = (answer, citations) => {
//   if (!citations || citations.length === 0) {
//     const disclaimerPhrases = [
//       'i couldn', 'i could', 'not found', 'no relevant', 'unable to find',
//       'insufficient information', 'based on the sources'
//     ];
//     const hasDisclaimer = disclaimerPhrases.some(phrase =>
//       answer.toLowerCase().includes(phrase)
//     );
//     return {
//       isGrounded: !hasDisclaimer,
//       reason: hasDisclaimer ? 'Answer contains disclaimer about missing sources' : 'No citations found'
//     };
//   }
//   return { isGrounded: true, reason: 'Answer has citations' };
// };

// // ─── Advanced Helper Functions ────────────────────────────────────────────────

// /**
//  * Formats timestamps (seconds) into MM:SS string
//  */
// const formatTimestamp = (seconds) => {
//   if (seconds == null) return '??:??';
//   const m = Math.floor(seconds / 60).toString().padStart(2, '0');
//   const s = Math.floor(seconds % 60).toString().padStart(2, '0');
//   return `${m}:${s}`;
// };

// /**
//  * Validates if the model's answer is grounded in provided sources
//  * @param {string} answer - Model's generated answer
//  * @param {Array} citations - Citations from the model
//  * @returns {boolean} - Whether answer is properly grounded
//  */
// export const validateAnswerGrounding = (answer, citations) => {
//   if (!citations || citations.length === 0) {
//     // If no citations, check if answer contains disclaimer-like phrases
//     const disclaimerPhrases = [
//       'i couldn', 'i could', 'not found', 'no relevant', 'unable to find',
//       'insufficient information', 'based on the sources'
//     ];
//     const hasDisclaimer = disclaimerPhrases.some(phrase =>
//       answer.toLowerCase().includes(phrase)
//     );
//     return !hasDisclaimer; // If no citations AND no disclaimer, likely hallucinated
//   }
//   return true; // Has citations, assume grounded
// };

// // ─── Helpers ─────────────────────────────────────────────────────────

// const formatTimestamp = (seconds) => {
//   if (seconds == null) return '??:??';
//   const m = Math.floor(seconds / 60).toString().padStart(2, '0');
//   const s = Math.floor(seconds % 60).toString().padStart(2, '0');
//   return `${m}:${s}`;
// };
