import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function findEmbeddings() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    const data = await response.json();
    const embeddingModels = data.data.filter(m => m.id.includes('embed'));
    console.log('Embedding Models Found:');
    embeddingModels.forEach(m => console.log(`- ${m.id}`));
  } catch (err) {
    console.error(err);
  }
}

findEmbeddings();
