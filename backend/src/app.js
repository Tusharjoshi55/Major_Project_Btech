require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authMiddleware = require('./middleware/authMiddleware');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const notebookRoutes = require('./routes/notebooks');
const sourceRoutes = require('./routes/sources');
const chatRoutes = require('./routes/chat');
const noteRoutes = require('./routes/notes');
const audioRoutes = require('./routes/audio');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Health check (public)
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// All routes below require auth
app.use('/api/notebooks', authMiddleware, notebookRoutes);
app.use('/api/sources', authMiddleware, sourceRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/notes', authMiddleware, noteRoutes);
app.use('/api/audio', authMiddleware, audioRoutes);

app.use(errorHandler);

module.exports = app;