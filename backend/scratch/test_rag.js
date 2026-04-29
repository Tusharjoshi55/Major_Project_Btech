import { retrieve } from '../src/services/ragService.js';
import pool from '../src/config/db.js';

const testRetrieve = async () => {
  try {
    // Find a notebook with chunks
    const { rows: chunks } = await pool.query(`SELECT notebook_id FROM chunks LIMIT 1`);
    if (!chunks.length) {
      console.log("No chunks found in DB. Please upload a file first.");
      return;
    }
    const notebookId = chunks[0].notebook_id;
    console.log(`Testing retrieval for notebook: ${notebookId}`);

    const results = await retrieve("test query", notebookId);
    console.log(`Found ${results.length} results.`);
    results.forEach((r, i) => {
      console.log(`[${i + 1}] Similarity: ${r.similarity.toFixed(4)} | Content: ${r.content.slice(0, 50)}...`);
    });

  } catch (error) {
    console.error("Test failed:", error.message);
  } finally {
    pool.end();
  }
};

testRetrieve();
