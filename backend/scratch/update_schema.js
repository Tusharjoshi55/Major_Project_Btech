import pool from '../src/config/db.js';

const updateSchema = async () => {
  try {
    console.log("Enabling required extensions...");
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    console.log("✅ Extensions ready.");

    console.log("Dropping existing chunks table to update vector dimensions...");
    await pool.query(`DROP TABLE IF EXISTS chunks CASCADE;`);

    console.log("Recreating chunks table with vector(2048)...");
    await pool.query(`
      CREATE TABLE chunks (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        source_id   UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
        chunk_index INT NOT NULL,
        content     TEXT NOT NULL,
        page_number INT,                  
        timestamp_start FLOAT,           
        timestamp_end   FLOAT,
        embedding   vector(2048),
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // NOTE: pgvector v0.8.x caps ANN indexes (IVFFlat, HNSW) at 2000 dims.
    // Since this model uses 2048 dims, we skip the index and use exact KNN.
    // Exact scan is slower at large scale but correct. Upgrade pgvector >0.8.x
    // or switch to a <=2000 dim model to re-enable the index.
    console.log("⚠️  Skipping vector index (2048 dims > 2000 dim index limit in pgvector 0.8.x).");

    console.log("✅ Schema updated successfully!");
  } catch (error) {
    console.error("❌ Failed to update schema:", error.message);
  } finally {
    pool.end();
  }
};

updateSchema();
