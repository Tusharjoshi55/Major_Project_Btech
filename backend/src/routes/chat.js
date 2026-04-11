import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import {
  sendMessage,
  getSessions,
  getHistory,
  deleteSession,
} from '../controllers/chatController.js';

const router = Router();

router.post('/',
  body('notebookId').isUUID(),
  body('message').isString().trim().notEmpty(),
  validate,
  sendMessage
);

router.get('/sessions/:notebookId', getSessions);
router.get('/history/:sessionId', getHistory);
router.delete('/sessions/:sessionId', deleteSession);

export default router;
