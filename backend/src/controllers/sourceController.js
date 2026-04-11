import { createRequire } from 'module';
import path from 'path';
import fs   from 'fs';
import { fileURLToPath } from 'url';

import pool               from '../config/db.js';
import { firebaseStorage } from '../config/firebase.js';
import { processSource }  from '../services/uploadService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ALLOWED_MIME_TO_TYPE = {
  'application/pdf': 'pdf',
  'audio/mpeg':      'mp3',
  'audio/mp3':       'mp3',
  'video/mp4':       'mp4',
};

// POST /api/sources/upload
export const uploadSource = async (req, res, next) => {
  try {
    const { notebookId } = req.body;
    const file = req.file;

    if (!file)        return res.status(400).json({ error: 'No file uploaded.' });
    if (!notebookId)  return res.status(400).json({ error: 'notebookId is required.' });

    const fileType = ALLOWED_MIME_TO_TYPE[file.mimetype];
    if (!fileType) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Unsupported file type. Use PDF, MP3, or MP4.' });
    }

    // Verify notebook belongs to user
    const nb = await pool.query(
      `SELECT id FROM notebooks WHERE id=$1 AND user_id=$2`,
      [notebookId, req.user.id]
    );
    if (!nb.rows.length) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: 'Notebook not found.' });
    }

    // Upload to Firebase Storage
    const bucket   = firebaseStorage.bucket();
    const destPath = `sources/${req.user.id}/${Date.now()}_${file.originalname}`;

    await bucket.upload(file.path, {
      destination: destPath,
      metadata: { contentType: file.mimetype },
    });

    const [signedUrl] = await bucket.file(destPath).getSignedUrl({
      action:  'read',
      expires: '01-01-2100',
    });

    // Insert source row (status = 'pending')
    const { rows } = await pool.query(
      `INSERT INTO sources
         (notebook_id, user_id, title, file_type, file_url, file_size, storage_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [notebookId, req.user.id, file.originalname, fileType, signedUrl, file.size, destPath]
    );
    const source = rows[0];

    // Respond immediately — processing is async
    res.status(202).json({
      source,
      message: 'Upload received. Processing started in background.',
    });

    // Background processing (non-blocking — don't await)
    processSource(source.id, signedUrl, fileType, file.path)
      .catch((err) => console.error(`Background processing failed for ${source.id}:`, err.message));

  } catch (err) { next(err); }
};

// GET /api/sources/:notebookId
export const getSources = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, file_type, file_url, status, file_size, error_message, created_at
       FROM sources
       WHERE notebook_id=$1 AND user_id=$2
       ORDER BY created_at DESC`,
      [req.params.notebookId, req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// GET /api/sources/:notebookId/:sourceId — single source with metadata
export const getSource = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, COUNT(c.id)::int AS chunk_count
       FROM sources s
       LEFT JOIN chunks c ON c.source_id = s.id
       WHERE s.id=$1 AND s.user_id=$2
       GROUP BY s.id`,
      [req.params.sourceId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Source not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// GET /api/sources/status/:sourceId — lightweight status polling
export const getSourceStatus = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, status, error_message, updated_at FROM sources WHERE id=$1 AND user_id=$2`,
      [req.params.sourceId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Source not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// DELETE /api/sources/:sourceId
export const deleteSource = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT storage_path FROM sources WHERE id=$1 AND user_id=$2`,
      [req.params.sourceId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Source not found.' });

    // Remove from Firebase Storage
    try {
      await firebaseStorage.bucket().file(rows[0].storage_path).delete();
    } catch (_) { /* ignore if file doesn't exist */ }

    // Cascades to chunks via FK
    await pool.query(`DELETE FROM sources WHERE id=$1`, [req.params.sourceId]);
    res.json({ success: true });
  } catch (err) { next(err); }
};
