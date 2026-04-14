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
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// Upload a new source file
router.post('/upload', upload.single('file'), uploadSource);

// ⚠️ CRITICAL: /status/:sourceId MUST be before /:notebookId
// otherwise Express matches "status" as a notebookId value

// Poll processing status
router.get('/status/:sourceId', getSourceStatus);

// Get all sources for a notebook
router.get('/:notebookId', getSources);

// Get single source with metadata
router.get('/:notebookId/:sourceId', getSource);

// Delete source + its chunks
router.delete('/:sourceId', deleteSource);

export default router;
