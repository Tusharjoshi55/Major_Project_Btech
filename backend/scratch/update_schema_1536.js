import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    console.log('Dropping existing chunks table to update embedding dimensions...');
    await pool.query('DROP TABLE IF EXISTS chunks CASCADE;');

    console.log('Recreating chunks table with vector(1536)...');
    await pool.query(`
      CREATE TABLE chunks (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
          source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
          chunk_index INTEGER NOT NULL,
          content TEXT NOT NULL,
          page_number INTEGER,
          timestamp_start FLOAT,
          timestamp_end FLOAT,
          embedding vector(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    console.log('Creating HNSW index for fast retrieval...');
    await pool.query(`
      CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `);

    console.log('Database updated successfully!');
  } catch (err) {
    console.error('Error updating schema:', err);
  } finally {
    pool.end();
  }
}

run();
