import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import pool from '../config/db.js';
import supabase from '../config/supabase.js';
import { processSource } from '../services/uploadService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MIME_TO_TYPE = {
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'video/mp4': 'mp4',
};

// POST /api/sources/upload
export const uploadSource = async (req, res, next) => {
  try {
    const { notebookId } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!notebookId) return res.status(400).json({ error: 'notebookId is required.' });

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

    // Upload to Supabase Storage
    const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'sources';
    console.log(`🚀 [DEBUG] Uploading to Supabase Bucket: ${SUPABASE_BUCKET}`);
    console.log(`🔗 [DEBUG] Supabase URL: ${process.env.SUPABASE_URL}`);

    // Check if bucket exists/is accessible
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
       console.error("❌ Failed to list Supabase buckets:", bucketError);
       fs.unlinkSync(file.path);
       return res.status(500).json({ error: `Storage configuration error: ${bucketError.message}` });
    }
    const bucketExists = buckets.find(b => b.name === SUPABASE_BUCKET);
    if (!bucketExists) {
       console.error(`❌ Supabase bucket '${SUPABASE_BUCKET}' does not exist.`);
       fs.unlinkSync(file.path);
       return res.status(500).json({ error: `Storage bucket '${SUPABASE_BUCKET}' not found in Supabase. Please manually create it in the Supabase Dashboard.` });
    }
    console.log(`✅ Bucket '${SUPABASE_BUCKET}' verified.`);

    const destPath = `sources/${req.user.id}/${Date.now()}_${file.originalname}`;
    console.log(`📦 Preparing to upload ${file.originalname} to ${destPath}`);
    const fileBody = fs.readFileSync(file.path);

    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(destPath, fileBody, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error("❌ Upload Error FULL:", uploadError);
      fs.unlinkSync(file.path);
      return res.status(500).json({ error: `Bucket upload failed: ${uploadError.message}` });
    }
    console.log(`✅ Upload successful: ${destPath}`);

    // Get signed URL (1 year expiration)
    const { data: signData, error: signError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(destPath, 60 * 60 * 24 * 365);

    if (signError) {
      // Small cleanup — we should ideally delete the bucket file if sign fails
      await supabase.storage.from(SUPABASE_BUCKET).remove([destPath]);
      fs.unlinkSync(file.path);
      return res.status(500).json({ error: `Shared URL failed: ${signError.message}` });
    }
    console.log(`✅ Signed URL generated.`);

    const signedUrl = signData.signedUrl;

    // Insert source row (status = 'pending')
    let source;
    try {
      const { rows } = await pool.query(
        `INSERT INTO sources
           (notebook_id, user_id, title, file_type, file_url, file_size, storage_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [notebookId, req.user.id, file.originalname, fileType, signedUrl, file.size, destPath]
      );
      source = rows[0];
    } catch (dbErr) {
      // Cleanup Supabase if DB fails
      const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'major_project';
      await supabase.storage.from(SUPABASE_BUCKET).remove([destPath]);
      throw dbErr;
    }

    // Respond immediately — processing is async
    res.status(202).json({
      source,
      message: 'Upload received. Processing started in background.',
    });

    // Background processing (non-blocking — don't await)
    console.log(`🚀 Started background processing for source ID: ${source.id}`);
    processSource(source.id, signedUrl, fileType, file.path)
      .catch(async (err) => {
        console.error(`❌ Unhandled background processing error for ${source.id}:`, err.message);
        // Fallback update in case it crashed before/outside the inner try-catch
        try {
          await pool.query(`UPDATE sources SET status='error', error_message=$1, updated_at=NOW() WHERE id=$2`, [err.message, source.id]);
        } catch (dbErr) {
          console.error(`  ❌ Failed to update source error status:`, dbErr.message);
        }
      });

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

    // Remove from Supabase Storage
    try {
      const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'major_project';
      await supabase.storage
        .from(SUPABASE_BUCKET)
        .remove([rows[0].storage_path]);
    } catch (_) { /* ignore if file doesn't exist */ }

    // Cascades to chunks via FK
    await pool.query(`DELETE FROM sources WHERE id=$1`, [req.params.sourceId]);
    res.json({ success: true });
  } catch (err) { next(err); }
};
