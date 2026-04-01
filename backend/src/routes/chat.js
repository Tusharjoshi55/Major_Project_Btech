const express = require('express');
const pool = require('../config/db');
const openai = require('../config/openai');
const ragService = require('../services/ragService');

const router = express.Router();

// POST /api/chat
router.post('/', async (req, res, next) => {
  try {
    const { notebookId, sessionId, message } = req.body;
    if (!notebookId || !message) {
      return res.status(400).json({ error: 'notebookId and message required' });
    }

    // Get or create session
    let sid = sessionId;
    if (!sid) {
      const { rows } = await pool.query(
        `INSERT INTO chat_sessions (notebook_id, user_id) VALUES ($1, $2) RETURNING id`,
        [notebookId, req.user.id]
      );
      sid = rows[0].id;
    }

    // Save user message
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
      [sid, message]
    );

    // RAG retrieval
    const chunks = await ragService.retrieve(message, notebookId);
    const systemPrompt = ragService.buildGroundedPrompt(chunks);

    // Fetch conversation history (last 10 messages)
    const { rows: history } = await pool.query(
      `SELECT role, content FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [sid]
    );
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.reverse().map((m) => ({ role: m.role, content: m.content })),
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
    });
    const reply = completion.choices[0].message.content;

    // Build citations array
    const citations = chunks.map((c) => ({
      source_id: c.source_id,
      title: c.source_title,
      page_number: c.page_number,
      timestamp: c.timestamp_start,
      file_type: c.file_type,
    }));

    // Save assistant reply
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, citations)
       VALUES ($1, 'assistant', $2, $3)`,
      [sid, reply, JSON.stringify(citations)]
    );

    res.json({ sessionId: sid, reply, citations });
  } catch (err) {
    next(err);
  }
});

module.exports = router;