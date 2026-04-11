import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import {
  uploadSource,
  getSources,
  getSource,
  getSourceStatus,
  deleteSource,
} from '../controllers/sourceController.js';

const router = Router();

// Store in OS temp dir; we'll move to Firebase Storage
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// Upload a new source file
router.post('/upload', upload.single('file'), uploadSource);

// Get all sources for a notebook
router.get('/:notebookId', getSources);

// Poll processing status
router.get('/status/:sourceId', getSourceStatus);

// Get single source with metadata
router.get('/:notebookId/:sourceId', getSource);

// Delete source + its chunks
router.delete('/:sourceId', deleteSource);

export default router;
