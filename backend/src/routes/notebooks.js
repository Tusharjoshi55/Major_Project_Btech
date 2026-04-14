import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import {
  getNotebooks,
  getNotebook,
  createNotebook,
  updateNotebook,
  deleteNotebook,
} from '../controllers/notebookController.js';

const router = Router();

router.get('/', getNotebooks);
router.get('/:id', getNotebook);

router.post('/',
  body('title').optional().isString().trim().isLength({ max: 200 }),
  validate,
  createNotebook
);

router.patch('/:id',
  body('title').optional().isString().trim().isLength({ max: 200 }),
  body('description').optional().isString().trim(),
  validate,
  updateNotebook
);

router.delete('/:id', deleteNotebook);

export default router;
