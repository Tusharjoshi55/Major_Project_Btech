import pool   from '../config/db.js';
import openai  from '../config/openai.js';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import supabase from '../config/supabase.js';

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

    const systemPrompt = `You are a master podcast script writer. Create a highly engaging, dynamic 2-person podcast conversation (Host: Alex, Guest: Sam) based ONLY on the provided source material.

Rules:
- Alex is the curious host who asks insightful, relatable questions.
- Sam is the enthusiastic expert who explains complex ideas simply, using analogies.
- Create a natural flow with back-and-forth banter, reactions (e.g., "Wow!", "Exactly!"), and a lively tone.
- Do not sound robotic; use conversational language and pauses (e.g., "...").
- Cover the most critical and interesting insights from the sources.
- Length: approximately 600-800 words of dialogue.
- Formatting must be strictly:
  ALEX: [dialogue]
  SAM: [dialogue]
- Conclude the episode with a quick recap of the top 3 takeaways.`;

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

    // Generate Audio
    let audioUrl = null;
    const tempFiles = [];
    try {
      for (const turn of turns) {
        const voice = turn.speaker === 'ALEX' ? 'alloy' : 'nova';
        const mp3 = await openai.audio.speech.create({
          model: 'tts-1',
          voice: voice,
          input: turn.text,
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        const tempPath = path.join(tmpdir(), `${uuidv4()}.mp3`);
        fs.writeFileSync(tempPath, buffer);
        tempFiles.push(tempPath);
      }

      const outPath = path.join(tmpdir(), `${uuidv4()}.mp3`);
      const command = ffmpeg();
      tempFiles.forEach(f => command.input(f));

      await new Promise((resolve, reject) => {
        command
          .on('error', (err) => {
              console.error('FFmpeg error:', err);
              reject(err);
          })
          .on('end', resolve)
          .mergeToFile(outPath);
      });

      const fileBuffer = fs.readFileSync(outPath);
      const fileName = `${notebookId}/${uuidv4()}.mp3`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('audio-overviews')
        .upload(fileName, fileBuffer, { contentType: 'audio/mpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('audio-overviews')
        .getPublicUrl(fileName);
        
      audioUrl = publicUrl;
      
      // Cleanup
      tempFiles.forEach(f => { try { fs.unlinkSync(f); } catch(e){} });
      try { fs.unlinkSync(outPath); } catch(e){}

    } catch (audioErr) {
      console.error('Audio generation failed:', audioErr);
      // We still return the script even if audio fails
    }

    res.json({
      script,
      turns,
      audioUrl,
      sourceCount: sources.length,
      tokensUsed: completion.usage?.total_tokens,
    });
  } catch (err) { next(err); }
};
