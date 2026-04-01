const express = require('express');
const pool = require('../config/db');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, COUNT(s.id) AS source_count
       FROM notebooks n
       LEFT JOIN sources s ON s.notebook_id = n.id
       WHERE n.user_id = $1
       GROUP BY n.id
       ORDER BY n.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO notebooks (user_id, title, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, title || 'Untitled Notebook', description || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const { rows } = await pool.query(
      `UPDATE notebooks SET title=$1, description=$2, updated_at=NOW()
       WHERE id=$3 AND user_id=$4 RETURNING *`,
      [title, description, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM notebooks WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;