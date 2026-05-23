import pool from '../config/db.js';
import openai from '../config/openai.js';
import * as ragService from '../services/ragService.js';
import * as webSearchService from '../services/webSearchService.js';

// POST /api/chat
export const sendMessage = async (req, res, next) => {
  try {
    const { notebookId, sessionId, message } = req.body;
    if (!notebookId || !message?.trim()) {
      return res.status(400).json({ error: 'notebookId and message are required.' });
    }

    // Verify notebook ownership
    const nb = await pool.query(
      `SELECT id FROM notebooks WHERE id=$1 AND user_id=$2`,
      [notebookId, req.user.id]
    );
    if (!nb.rows.length) return res.status(404).json({ error: 'Notebook not found.' });

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

    // RAG: retrieve relevant chunks
    console.log(`🔍 [CHAT] Retrieving chunks for notebook: ${notebookId}`);
    const chunks = await ragService.retrieve(message, notebookId);
    console.log(`📚 [CHAT] Found ${chunks.length} relevant chunks`);

    const maxSimilarity = chunks.length > 0 ? chunks[0].similarity : 0;
    let webResults = [];

    // Trigger web search enhancement if no chunks matched, or if similarity is below threshold
    if (chunks.length === 0 || maxSimilarity < 0.45) {
      console.log(`🌐 [CHAT] PDF similarity too low (${maxSimilarity.toFixed(2)}) or no chunks found. Triggering Web Search...`);
      webResults = await webSearchService.search(message);
    }

    const systemPrompt = ragService.buildGroundedPrompt(chunks, webResults);

    // Load last 10 messages for context
    const { rows: history } = await pool.query(
      `SELECT role, content FROM chat_messages
        WHERE session_id=$1
        ORDER BY created_at DESC LIMIT 10`,
      [sid]
    );

    console.log(`💬 [CHAT] Loaded history: ${history.length} messages`);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.reverse().map(m => ({ role: m.role, content: m.content })),
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-lite-001',
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    });

    const reply = completion.choices[0].message.content;

    // Build citations array
    const citations = chunks.map(c => ({
      source_id: c.source_id,
      title: c.source_title,
      file_type: c.file_type,
      page_number: c.page_number ?? null,
      timestamp_start: c.timestamp_start ?? null,
    }));

    // Inject web search results as citations if used
    if (webResults && webResults.length > 0) {
      webResults.forEach(r => {
        citations.push({
          source_id: 'web',
          title: r.title,
          file_type: 'web',
          url: r.url,
          snippet: r.snippet
        });
      });
    }

    // Save assistant reply with citations
    const { rows: savedMsg } = await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, citations)
        VALUES ($1, 'assistant', $2, $3)
        RETURNING *`,
      [sid, reply, JSON.stringify(citations)]
    );

    res.json({
      sessionId: sid,
      message: savedMsg[0],
      reply,
      citations,
      tokensUsed: completion.usage?.total_tokens,
    });
  } catch (err) { next(err); }
};

// GET /api/chat/sessions/:notebookId — list sessions
export const getSessions = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT cs.id, cs.created_at,
          (SELECT content FROM chat_messages
            WHERE session_id=cs.id AND role='user'
            ORDER BY created_at ASC LIMIT 1) AS first_message
        FROM chat_sessions cs
        WHERE cs.notebook_id=$1 AND cs.user_id=$2
        ORDER BY cs.created_at DESC`,
      [req.params.notebookId, req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// GET /api/chat/history/:sessionId — messages in a session
export const getHistory = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT cm.*
        FROM chat_messages cm
        JOIN chat_sessions cs ON cs.id = cm.session_id
        WHERE cm.session_id=$1 AND cs.user_id=$2
        ORDER BY cm.created_at ASC`,
      [req.params.sessionId, req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// DELETE /api/chat/sessions/:sessionId
export const deleteSession = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM chat_sessions
        WHERE id=$1 AND user_id=$2`,
      [req.params.sessionId, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Session not found.' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// DELETE /api/chat/message/:messageId — delete a single message
export const deleteMessage = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM chat_messages cm
        USING chat_sessions cs
        WHERE cm.id = $1
          AND cm.session_id = cs.id
          AND cs.user_id = $2`,
      [req.params.messageId, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Message not found.' });
    res.json({ success: true });
  } catch (err) { next(err); }
};
