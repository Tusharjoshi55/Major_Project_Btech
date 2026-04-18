import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { authMiddleware } from './middleware/authMiddleware.js';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';

import notebookRoutes from './routes/notebooks.js';
import sourceRoutes from './routes/sources.js';
import chatRoutes from './routes/chat.js';
import noteRoutes from './routes/notes.js';
import audioRoutes from './routes/audio.js';

const app = express();

// ─── Security & Logging ──────────────────────────────────────────────
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── CORS ────────────────────────────────────────────────────────────
app.use(cors({
    // origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    origin: "*",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ───────────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 100,
    standardHeaders: true,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ─── Public Routes ───────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
}));

// ─── Protected API Routes ────────────────────────────────────────────
app.use('/api/notebooks', authMiddleware, notebookRoutes);
app.use('/api/sources', authMiddleware, sourceRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/notes', authMiddleware, noteRoutes);
app.use('/api/audio', authMiddleware, audioRoutes);

// ─── Error Handling ──────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
