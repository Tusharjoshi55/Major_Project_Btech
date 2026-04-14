import pool from '../config/db.js';
import { firebaseStorage } from '../config/firebase.js';

// GET /api/notebooks
export const getNotebooks = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         n.*,
         COUNT(DISTINCT s.id)::int  AS source_count,
         COUNT(DISTINCT nt.id)::int AS note_count
       FROM notebooks n
       LEFT JOIN sources s  ON s.notebook_id  = n.id
       LEFT JOIN notes   nt ON nt.notebook_id = n.id
       WHERE n.user_id = $1
       GROUP BY n.id
       ORDER BY n.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// GET /api/notebooks/:id
export const getNotebook = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*,
         COUNT(DISTINCT s.id)::int  AS source_count,
         COUNT(DISTINCT nt.id)::int AS note_count
       FROM notebooks n
       LEFT JOIN sources s  ON s.notebook_id  = n.id
       LEFT JOIN notes   nt ON nt.notebook_id = n.id
       WHERE n.id = $1 AND n.user_id = $2
       GROUP BY n.id`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notebook not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// POST /api/notebooks
export const createNotebook = async (req, res, next) => {
  try {
    let { title = 'Untitled Notebook', description = '' } = req.body;
    
    title = title.trim();
    if (!title) title = 'Untitled Notebook';

    const { rows } = await pool.query(
      `INSERT INTO notebooks (user_id, title, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, title, description]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

// PATCH /api/notebooks/:id — partial update
export const updateNotebook = async (req, res, next) => {
  try {
    const { title, description } = req.body;

    // Build a dynamic SET clause from only the provided fields
    const fields = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) { 
      const t = title.trim();
      fields.push(`title=$${idx++}`); 
      values.push(t || 'Untitled Notebook'); 
    }
    if (description !== undefined) { 
      fields.push(`description=$${idx++}`); 
      values.push(description); 
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    fields.push(`updated_at=NOW()`);
    
    const { rows } = await pool.query(
      `UPDATE notebooks SET ${fields.join(', ')}
       WHERE id=$${idx} AND user_id=$${idx + 1}
       RETURNING *`,
      [...values, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notebook not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};


// DELETE /api/notebooks/:id
export const deleteNotebook = async (req, res, next) => {
  try {
    // 1. Get all sources to clean up Firebase Storage
    const { rows: sources } = await pool.query(
      `SELECT storage_path FROM sources WHERE notebook_id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );

    // 2. Delete files from Firebase asynchronously
    const bucket = firebaseStorage.bucket();
    const deletePromises = sources
      .filter(s => s.storage_path)
      .map(s => bucket.file(s.storage_path).delete().catch(() => {}));
    
    await Promise.all(deletePromises);

    // 3. Delete from DB (cascades to sources, notes, etc.)
    const { rowCount } = await pool.query(
      `DELETE FROM notebooks WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    
    if (!rowCount) return res.status(404).json({ error: 'Notebook not found.' });
    res.json({ success: true, message: 'Notebook and all associated data deleted.' });
  } catch (err) { next(err); }
};

