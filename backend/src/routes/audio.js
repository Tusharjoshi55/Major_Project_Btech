import { Router } from 'express';
import { body }   from 'express-validator';
import { validate } from '../middleware/validate.js';
import { generateAudioOverview } from '../controllers/audioController.js';

const router = Router();

router.post('/overview',
  body('notebookId').isUUID(),
  body('sourceIds').optional().isArray(),
  validate,
  generateAudioOverview
);

export default router;
