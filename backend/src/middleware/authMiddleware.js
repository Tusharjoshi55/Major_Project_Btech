import supabase from '../config/supabase.js';
import pool from '../config/db.js';

/**
 * Middleware: Verify Supabase Session Token and Upsert User Record
 * 
 * Replaces firebase-admin logic with Supabase Auth verification.
 */
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    console.warn("🚫 Unauthorized Request: Missing token");
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1. Verify token and get user from Supabase Auth
    // The service_role client can verify tokens for individual users
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.warn('❌ Auth verification failed:', authError?.message);
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    // 2. Perform User Upsert (Sync with metadata)
    const { email, user_metadata } = user;
    const { rows } = await pool.query(
      `INSERT INTO users (supabase_uid, email, display_name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (supabase_uid)
       DO UPDATE SET
         email        = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         avatar_url   = EXCLUDED.avatar_url,
         updated_at   = NOW()
       RETURNING *`,
      [
        user.id,
        email ?? '',
        user_metadata?.display_name ?? user_metadata?.name ?? null,
        user_metadata?.avatar_url ?? user_metadata?.picture ?? null,
      ]
    );

    // 3. Attach User Data to Request object
    req.user = rows[0];
    req.supabaseUid = user.id;

    next();
  } catch (err) {
    console.error('🔥 Server Auth Middleware Error:', err.message);
    return res.status(500).json({ error: 'Internal server error processing authentication.' });
  }
};