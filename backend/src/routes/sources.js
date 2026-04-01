const express = require('express');
const multer = require('multer');
const os = require('os');
const path = require('path');
const { initializeApp } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const pool = require('../config/db');
const { processSource } = require('../services/uploadService');

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'video/mp4': 'mp4',
};

// POST /api/sources/upload
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const { notebookId } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    if (!notebookId) return res.status(400).json({ error: 'notebookId required' });

    const fileType = ALLOWED_TYPES[file.mimetype];
    if (!fileType) {
      return res.status(400).json({ error: 'Unsupported file type. Use PDF, MP3, or MP4.' });
    }

    // Upload to Firebase Storage
    const bucket = getStorage().bucket();
    const destPath = `sources/${req.user.id}/${Date.now()}_${file.originalname}`;
    await bucket.upload(file.path, {
      destination: destPath,
      metadata: { contentType: file.mimetype },
    });
    const [fileRef] = await bucket.file(destPath).getSignedUrl({
      action: 'read',
      expires: '01-01-2100',
    });

    // Insert source row
    const { rows } = await pool.query(
      `INSERT INTO sources (notebook_id, user_id, title, file_type, file_url, file_size)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [notebookId, req.user.id, file.originalname, fileType, fileRef, file.size]
    );
    const source = rows[0];

    // Respond immediately — process in background
    res.status(202).json({ source, message: 'Upload received, processing started' });

    // Background processing (non-blocking)
    processSource(source.id, fileRef, fileType, file.path).catch(console.error);

  } catch (err) {
    next(err);
  }
});

// GET /api/sources/:notebookId
router.get('/:notebookId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, file_type, file_url, status, file_size, created_at
       FROM sources
       WHERE notebook_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [req.params.notebookId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;