import fs from 'fs';
import { createRequire } from 'module';

// pdf-parse is CommonJS only — use createRequire
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const CHUNK_SIZE = 500;  // words per chunk
const CHUNK_OVERLAP = 50;   // word overlap between chunks

/**
 * Extracts text per page from a PDF file.
 * @param {string} filePath — local temp path
 * @returns {Array<{page: number, text: string}>}
 */
export const extractPages = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);

  const pages = [];

  const data = await pdfParse(dataBuffer, {
    pagerender: async (pageData) => {
      const content = await pageData.getTextContent();
      const text = content.items.map(i => i.str).join(' ').trim();
      pages.push({ page: pages.length + 1, text });
      return text;
    },
  });

  // Fallback: if pagerender didn't fire, split by form-feed
  if (!pages.length) {
    const rawPages = data.text.split('\f').filter(Boolean);
    rawPages.forEach((text, i) => pages.push({ page: i + 1, text: text.trim() }));
  }

  return pages;
};

/**
 * Splits page array into overlapping word-chunks for embedding.
 * @param {Array<{page,text}>} pages
 * @returns {Array<{content, page_number, timestamp_start, timestamp_end, chunk_index}>}
 */
export const buildChunks = (pages) => {
  const chunks = [];
  let chunkIndex = 0;

  for (const { page, text } of pages) {
    const words = text.split(/\s+/).filter(Boolean);

    for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const slice = words.slice(i, i + CHUNK_SIZE).join(' ');
      if (slice.trim().length < 30) continue; // skip trivially small chunks

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
