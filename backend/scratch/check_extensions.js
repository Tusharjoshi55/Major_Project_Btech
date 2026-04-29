import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`SELECT name, default_version FROM pg_available_extensions WHERE name LIKE '%vector%'`)
  .then(r => {
    console.log('Available vector extensions:', JSON.stringify(r.rows, null, 2));
    return pool.query(`SELECT version()`);
  })
  .then(r => {
    console.log('PostgreSQL version:', r.rows[0].version);
    pool.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    pool.end();
  });
