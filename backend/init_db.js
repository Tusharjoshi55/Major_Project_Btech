import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pool from './src/config/db.js';

const schemaPath = path.join(process.cwd(), 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

async function initDB() {
  console.log('Initializing database schema...');
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let successCount = 0;
  let failCount = 0;

  for (const statement of statements) {
    try {
      await pool.query(statement);
      successCount++;
    } catch (err) {
      failCount++;
      console.warn(`⚠️ Statement failed: "${statement.slice(0, 50)}..."`);
      console.error(`   Error: ${err.message}`);
    }
  }

  console.log(`\nInitialization finished.`);
  console.log(`✅ ${successCount} statements executed successfully.`);
  if (failCount > 0) {
    console.log(`❌ ${failCount} statements failed (likely due to missing 'vector' extension).`);
  }
  pool.end();
}

initDB();
