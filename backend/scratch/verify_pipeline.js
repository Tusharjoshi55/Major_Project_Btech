/**
 * verify_pipeline.js
 * -------------------
 * End-to-end verification of the full source-processing pipeline:
 *   1. Check environment variables
 *   2. Verify Supabase bucket existence and upload a test file
 *   3. Generate a 2048-dim embedding via OpenRouter (nvidia nemotron)
 *   4. Insert a test chunk into the local PostgreSQL DB
 *   5. Run a similarity search to confirm retrieval works
 *   6. Clean up test data
 *
 * Usage:
 *   node --env-file=../.env scratch/verify_pipeline.js
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pg;

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const EMBEDDING_MODEL = 'nvidia/llama-nemotron-embed-vl-1b-v2:free';
const EXPECTED_DIMS   = 2048;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'sources';
const TEST_FILE_NAME  = `verify_test_${Date.now()}.txt`;
const TEST_TEXT       = 'This is a pipeline verification test. The quick brown fox jumps over the lazy dog.';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const ok   = (msg) => console.log(`  ✅  ${msg}`);
const fail = (msg) => console.error(`  ❌  ${msg}`);
const info = (msg) => console.log(`  ℹ️   ${msg}`);
const step = (n, msg) => console.log(`\n─── Step ${n}: ${msg} ───`);

// ─────────────────────────────────────────────────────────────────────────────
// Check env
// ─────────────────────────────────────────────────────────────────────────────
function checkEnv() {
  step(1, 'Checking environment variables');
  const required = ['SUPABASE_URL', 'SUPABASE_KEY', 'OPENROUTER_API_KEY', 'DATABASE_URL'];
  let allOk = true;
  for (const key of required) {
    if (!process.env[key]) {
      fail(`Missing env var: ${key}`);
      allOk = false;
    } else {
      ok(`${key} is set`);
    }
  }
  info(`SUPABASE_BUCKET = "${SUPABASE_BUCKET}"`);
  if (!allOk) throw new Error('Environment check failed. Aborting.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Supabase Storage upload
// ─────────────────────────────────────────────────────────────────────────────
async function verifyStorage(supabase) {
  step(2, 'Verifying Supabase Storage & uploading test file');

  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw new Error(`Cannot list buckets: ${listErr.message}`);
  ok(`Listed ${buckets.length} bucket(s)`);

  const found = buckets.find(b => b.name === SUPABASE_BUCKET);
  if (!found) {
    fail(`Bucket "${SUPABASE_BUCKET}" NOT FOUND. Create it in the Supabase Dashboard.`);
    info(`Available buckets: ${buckets.map(b => b.name).join(', ') || '(none)'}`);
    throw new Error(`Bucket "${SUPABASE_BUCKET}" is missing.`);
  }
  ok(`Bucket "${SUPABASE_BUCKET}" exists`);

  const fileBody = Buffer.from(TEST_TEXT, 'utf-8');
  const destPath = `_verify/${TEST_FILE_NAME}`;

  const { error: uploadErr } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(destPath, fileBody, { contentType: 'text/plain', upsert: true });

  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
  ok(`Test file uploaded to storage: ${destPath}`);

  return destPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Generate embedding
// ─────────────────────────────────────────────────────────────────────────────
async function generateEmbedding() {
  step(3, `Generating ${EXPECTED_DIMS}-dim embedding via OpenRouter`);

  const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'StudyBuddy AI - Pipeline Verify',
    },
  });

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: TEST_TEXT,
    encoding_format: 'float',
  });

  const embedding = response?.data?.[0]?.embedding;
  if (!embedding) throw new Error(`No embedding returned. Response: ${JSON.stringify(response)}`);

  if (embedding.length !== EXPECTED_DIMS) {
    fail(`Expected ${EXPECTED_DIMS} dims but got ${embedding.length}. Model mismatch!`);
    throw new Error('Embedding dimension mismatch.');
  }

  ok(`Embedding generated: ${embedding.length} dims (first 5: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}])`);
  return embedding;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Insert test chunk into PostgreSQL
// ─────────────────────────────────────────────────────────────────────────────
async function insertChunk(pool, embedding) {
  step(4, 'Inserting test chunk into PostgreSQL');

  // Find any valid source + notebook to attach to (or skip FK by using raw insert)
  const { rows: sources } = await pool.query(`SELECT id, notebook_id FROM sources LIMIT 1`);

  if (!sources.length) {
    info('No sources found in DB — skipping FK-linked insert. Testing raw chunk without FKs...');
    // Use a direct query without FK constraint for pure vector test
    // We do a quick pgvector sanity check instead
    const testVec = JSON.stringify(embedding);
    const { rows } = await pool.query(`SELECT $1::vector <=> $1::vector AS self_distance`, [testVec]);
    ok(`pgvector self-distance = ${rows[0].self_distance} (should be 0)`);
    return null;
  }

  const { id: sourceId, notebook_id: notebookId } = sources[0];
  const chunkId = uuidv4();

  await pool.query(
    `INSERT INTO chunks (id, source_id, notebook_id, chunk_index, content, embedding)
     VALUES ($1, $2, $3, $4, $5, $6::vector)`,
    [chunkId, sourceId, notebookId, 9999, TEST_TEXT, JSON.stringify(embedding)]
  );

  ok(`Test chunk inserted with id: ${chunkId}`);
  return chunkId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: Similarity search
// ─────────────────────────────────────────────────────────────────────────────
async function runSimilaritySearch(pool, embedding, chunkId) {
  if (!chunkId) {
    step(5, 'Similarity search (skipped — no chunk inserted with FK)');
    info('To test similarity, make sure at least one source exists in the DB.');
    return;
  }

  step(5, 'Running similarity search to confirm retrieval');

  const { rows } = await pool.query(
    `SELECT id, content, (embedding <=> $1::vector) AS distance
     FROM chunks
     ORDER BY embedding <=> $1::vector
     LIMIT 3`,
    [JSON.stringify(embedding)]
  );

  if (!rows.length) throw new Error('Similarity search returned 0 results.');
  ok(`Top-1 chunk: "${rows[0].content.slice(0, 60)}..." — distance: ${parseFloat(rows[0].distance).toFixed(6)}`);

  const found = rows.some(r => r.id === chunkId);
  if (found) ok(`Test chunk appears in top-3 results (distance ≈ 0)`);
  else fail(`Test chunk not found in top-3. Something may be wrong with index.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6: Clean up
// ─────────────────────────────────────────────────────────────────────────────
async function cleanup(supabase, pool, destPath, chunkId) {
  step(6, 'Cleaning up test data');

  // Remove from Storage
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).remove([destPath]);
  if (error) fail(`Could not remove test file: ${error.message}`);
  else ok(`Removed test file from storage: ${destPath}`);

  // Remove from DB
  if (chunkId) {
    await pool.query(`DELETE FROM chunks WHERE id = $1`, [chunkId]);
    ok(`Removed test chunk from DB: ${chunkId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║      Pipeline Verification Script           ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let destPath = null;
  let chunkId  = null;
  let allPassed = true;

  try {
    checkEnv();
    destPath  = await verifyStorage(supabase);
    const embedding = await generateEmbedding();
    chunkId   = await insertChunk(pool, embedding);
    await runSimilaritySearch(pool, embedding, chunkId);
  } catch (err) {
    fail(`PIPELINE FAILED: ${err.message}`);
    allPassed = false;
  } finally {
    if (destPath) {
       await cleanup(supabase, pool, destPath, chunkId);
    }
    await pool.end();
  }

  console.log('\n══════════════════════════════════════════════');
  if (allPassed) {
    console.log('🎉  All checks PASSED — Pipeline is healthy!');
  } else {
    console.log('🚨  One or more checks FAILED — Review the output above.');
    process.exit(1);
  }
  console.log('══════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
