import pool   from '../config/db.js';
import openai  from '../config/openai.js';

// POST /api/audio/overview
export const generateAudioOverview = async (req, res, next) => {
  try {
    const { notebookId, sourceIds } = req.body;
    if (!notebookId) return res.status(400).json({ error: 'notebookId is required.' });

    // Pull source content — either specific sources or all ready sources in notebook
    let query = `
      SELECT s.title, s.file_type, s.metadata
      FROM sources s
      WHERE s.notebook_id=$1 AND s.user_id=$2 AND s.status='ready'`;
    const params = [notebookId, req.user.id];

    if (sourceIds?.length) {
      query += ` AND s.id = ANY($3::uuid[])`;
      params.push(sourceIds);
    }

    const { rows: sources } = await pool.query(query, params);
    if (!sources.length) {
      return res.status(400).json({ error: 'No ready sources found. Please wait for processing to complete.' });
    }

    // Build context from sources
    const context = sources.map(s => {
      if (s.file_type === 'pdf') {
        const pages = s.metadata?.pages || [];
        const excerpt = pages.slice(0, 5).map(p => p.text).join('\n').slice(0, 2000);
        return `[Document: ${s.title}]\n${excerpt}`;
      } else {
        const segments = s.metadata?.transcript || [];
        const excerpt = segments.slice(0, 20).map(t => t.text).join(' ').slice(0, 2000);
        return `[${s.file_type.toUpperCase()}: ${s.title}]\n${excerpt}`;
      }
    }).join('\n\n---\n\n');

    const systemPrompt = `You are a podcast script writer. Create a lively, engaging 2-person podcast conversation (Host: Alex, Guest: Sam) based ONLY on the provided source material.

Rules:
- Alex asks insightful questions; Sam explains ideas clearly with enthusiasm
- Include natural back-and-forth, occasional humor, and "wow" moments
- Cover the most important insights from the sources
- Length: approximately 800-1000 words of dialogue
- Format exactly as:
  ALEX: [dialogue]
  SAM: [dialogue]
- End with a concise summary of key takeaways`;

    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a podcast episode from these sources:\n\n${context}` },
      ],
      temperature: 0.8,
      max_tokens: 1500,
    });

    const script = completion.choices[0].message.content;

    // Parse into structured turns
    const turns = script
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const match = line.match(/^(ALEX|SAM):\s*(.+)$/);
        if (match) return { speaker: match[1], text: match[2] };
        return null;
      })
      .filter(Boolean);

    res.json({
      script,
      turns,
      sourceCount: sources.length,
      tokensUsed: completion.usage?.total_tokens,
    });
  } catch (err) { next(err); }
};
