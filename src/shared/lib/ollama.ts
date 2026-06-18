// src/shared/lib/ollama.ts

import { createOpenAI } from "@ai-sdk/openai";

export const ollamaConfig = {
  baseURL: "https://ollama.com",
  apiKey: process.env.OLLAMA_API_KEY!,
  compatibility: "compatible" as const,
};

export const ollama = createOpenAI(ollamaConfig);
