import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://user:password@localhost:5432/notebooklm_db' });

async function check() {
  try {
    const res = await pool.query('SELECT * FROM users');
    console.log("Users:", res.rows);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    pool.end();
  }
}

check();
