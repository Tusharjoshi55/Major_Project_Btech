import pool from '../config/db.js';

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
    const { title = 'Untitled Notebook', description = '' } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO notebooks (user_id, title, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, title, description]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

// PATCH /api/notebooks/:id
export const updateNotebook = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const { rows } = await pool.query(
      `UPDATE notebooks
       SET title=$1, description=$2, updated_at=NOW()
       WHERE id=$3 AND user_id=$4
       RETURNING *`,
      [title, description, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notebook not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// DELETE /api/notebooks/:id
export const deleteNotebook = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM notebooks WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Notebook not found.' });
    res.json({ success: true });
  } catch (err) { next(err); }
};
