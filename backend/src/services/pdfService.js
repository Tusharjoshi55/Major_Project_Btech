const fs = require('fs');
const path = require('path');
// Install: npm install pdf-parse
const pdfParse = require('pdf-parse');

const CHUNK_SIZE = 500;       // words per chunk
const CHUNK_OVERLAP = 50;     // word overlap between chunks

/**
 * Extracts text per page from a PDF file.
 * Returns: [{ page: 1, text: "..." }, ...]
 */
const extractPages = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer, {
    pagerender: (pageData) => pageData.getTextContent().then((textContent) =>
      textContent.items.map((item) => item.str).join(' ')
    ),
  });

  // pdf-parse gives full text; split by page using \f (form feed) if available
  const rawPages = data.text.split('\f').filter(Boolean);
  return rawPages.map((text, i) => ({ page: i + 1, text: text.trim() }));
};

/**
 * Splits pages into overlapping chunks for embedding.
 * Returns: [{ content, page_number, chunk_index }]
 */
const buildChunks = (pages, sourceId) => {
  const chunks = [];
  let chunkIndex = 0;

  for (const { page, text } of pages) {
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const slice = words.slice(i, i + CHUNK_SIZE).join(' ');
      if (slice.trim().length < 30) continue; // skip tiny chunks
      chunks.push({
        content: slice,
        page_number: page,
        timestamp_start: null,
        timestamp_end: null,
        chunk_index: chunkIndex++,
      });
    }
  }

  return chunks;
};

module.exports = { extractPages, buildChunks };