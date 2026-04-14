import pool from '../config/db.js';

// GET /api/notes/:notebookId
export const getNotes = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notes
       WHERE notebook_id=$1 AND user_id=$2
       ORDER BY updated_at DESC`,
      [req.params.notebookId, req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// GET /api/notes/single/:noteId
export const getNote = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notes WHERE id=$1 AND user_id=$2`,
      [req.params.noteId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Note not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// POST /api/notes
export const createNote = async (req, res, next) => {
  try {
    let { notebookId, title = 'Untitled Note', content = '' } = req.body;
    if (!notebookId) return res.status(400).json({ error: 'notebookId is required.' });

    title = title.trim() || 'Untitled Note';

    const { rows } = await pool.query(
      `INSERT INTO notes (notebook_id, user_id, title, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [notebookId, req.user.id, title, content]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

// PATCH /api/notes/:noteId — partial update
export const updateNote = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) { 
      fields.push(`title=$${idx++}`); 
      values.push(title.trim() || 'Untitled Note'); 
    }
    if (content !== undefined) { 
      fields.push(`content=$${idx++}`); 
      values.push(content); 
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    fields.push(`updated_at=NOW()`);

    values.push(req.params.noteId, req.user.id);

    const { rows } = await pool.query(
      `UPDATE notes SET ${fields.join(', ')}
       WHERE id=$${idx} AND user_id=$${idx + 1}
       RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Note not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};


// DELETE /api/notes/:noteId
export const deleteNote = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM notes WHERE id=$1 AND user_id=$2`,
      [req.params.noteId, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Note not found.' });
    res.json({ success: true });
  } catch (err) { next(err); }
};
