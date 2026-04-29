import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

async function testEmbedding() {
  try {
    const response = await openai.embeddings.create({
      model: 'nomic-ai/nomic-embed-text-v1.5',
      input: 'This is a test to see if OpenRouter supports this embedding model.',
    });
    console.log('SUCCESS! Dimensions:', response.data[0].embedding.length);
  } catch (err) {
    console.error('FAILED:', err.message || err);
  }
}

testEmbedding();
