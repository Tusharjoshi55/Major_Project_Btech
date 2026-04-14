import { firebaseAuth } from '../config/firebase.js';
import pool from '../config/db.js';

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    console.error("❌ Missing Authorization header");
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    // Verify Firebase ID token
    decoded = await firebaseAuth.verifyIdToken(token);
  } catch (err) {
    console.error('❌ Auth middleware error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  try {
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
      [
        decoded.uid,
        decoded.email ?? '',
        decoded.name ?? null,
        decoded.picture ?? null,
      ]
    );

    req.user = rows[0];
    req.firebaseUid = decoded.uid;

    next();
  } catch (dbErr) {
    console.error('❌ DB error in auth:', dbErr.message);
    return res.status(500).json({ error: 'Internal server error processing authentication.' });
  }
};