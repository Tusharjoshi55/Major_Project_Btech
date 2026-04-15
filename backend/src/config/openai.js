import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    // Enable Azure API compatibility if needed
    baseURL: process.env.OPENAI_BASE_URL,
    // Default timeout settings
    timeout: 60000, // 60 seconds
    // Retry configuration - handled at service level for better control
    maxRetries: 0,
});

// Optional: Configure Azure OpenAI endpoint
// if (process.env.OPENAI_BASE_URL) {
//   openai.baseURL = process.env.OPENAI_BASE_URL;
// }

export default openai;