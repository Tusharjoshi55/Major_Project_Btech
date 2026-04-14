import 'dotenv/config';
import pool from './src/config/db.js';

async function testConnection() {
  console.log('Testing DB connection...');
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Connected to DB! Server time:', res.rows[0].now);

    console.log('Checking sources table schema...');
    const schema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sources';
    `);
    
    const hasStoragePath = schema.rows.some(row => row.column_name === 'storage_path');
    console.log('- storage_path column exists:', hasStoragePath);
    
    if (!hasStoragePath) {
      console.log('Applying migration to add storage_path...');
      await pool.query('ALTER TABLE sources ADD COLUMN IF NOT EXISTS storage_path TEXT;');
      console.log('Migration applied successfully.');
    }
  } catch (err) {
    console.error('DB Connection error:', err.message);
  } finally {
    pool.end();
  }
}

testConnection();
