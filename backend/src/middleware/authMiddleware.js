const admin = require('../config/firebase');
const pool = require('../config/db');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify Firebase JWT
    const decoded = await admin.auth().verifyIdToken(token);

    // Upsert user in PostgreSQL
    const { rows } = await pool.query(
      `INSERT INTO users (firebase_uid, email, display_name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (firebase_uid)
       DO UPDATE SET
         email        = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         avatar_url   = EXCLUDED.avatar_url,
         updated_at   = NOW()
       RETURNING *`,
      [decoded.uid, decoded.email, decoded.name || null, decoded.picture || null]
    );

    req.user = rows[0]; // full DB user row
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;