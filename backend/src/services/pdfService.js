import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

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

  try {
    const parser = new pdf.PDFParse(new Uint8Array(dataBuffer));
    await parser.load();

    const textResult = await parser.getText();
    const fullText = (typeof textResult === 'string') ? textResult : (textResult?.text || '');
    
    // Split by form-feed character which represents page boundaries in most PDFs
    const rawPages = fullText.split('\f').filter(Boolean);
    
    if (rawPages.length > 0) {
      rawPages.forEach((t, i) => {
        pages.push({ page: i + 1, text: t.trim() });
      });
    } else if (fullText.trim()) {
      // Fallback if no form-feeds
      pages.push({ page: 1, text: fullText.trim() });
    }
  } catch (err) {
    console.error("PDF extraction error:", err.message);
    // Fallback or rethrow
    throw err;
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
