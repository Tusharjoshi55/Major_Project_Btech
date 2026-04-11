import { firebaseAuth } from '../config/firebase.js';
import pool from '../config/db.js';

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1. Verify Firebase ID token
    const decoded = await firebaseAuth.verifyIdToken(token);

    // 2. Upsert user in PostgreSQL (sync Firebase → our DB)
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

    req.user = rows[0];       // Full DB user row
    req.firebaseUid = decoded.uid;   // Raw Firebase UID
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);

    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
