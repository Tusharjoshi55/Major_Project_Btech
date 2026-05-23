


import OpenAI from "openai";

// For Chat, Summaries, and Audio generation (Free via OpenRouter)
const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "StudyBuddy AI",
    },
});

export default openai;