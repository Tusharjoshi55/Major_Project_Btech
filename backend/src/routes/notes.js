import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import {
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} from '../controllers/noteController.js';

const router = Router();

// ⚠️ CRITICAL: /single/:noteId MUST be before /:notebookId
// otherwise Express matches "single" as a notebookId value
router.get('/single/:noteId', getNote);
router.get('/:notebookId', getNotes);


router.post('/',
  body('notebookId').isUUID(),
  body('title').optional().isString().trim().isLength({ max: 300 }),
  body('content').optional().isString(),
  validate,
  createNote
);

router.patch('/:noteId',
  body('title').optional().isString().trim().isLength({ max: 300 }),
  body('content').optional().isString(),
  validate,
  updateNote
);

router.delete('/:noteId', deleteNote);

export default router;
