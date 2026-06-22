// src/shared/lib/ollama.ts

import { createOpenAI } from "@ai-sdk/openai";
import { predictionConfig } from "./predictionConfig";

export const ollamaConfig = {
  baseURL: predictionConfig.ollama.baseURL,
  apiKey: predictionConfig.ollama.apiKey,
  compatibility: "compatible" as const,
};

export const ollama = createOpenAI(ollamaConfig);

// ---------------------------------------------------------------------------
// Direct fetch helper for prediction engine (OpenAI-compatible /v1/chat/completions)
// ---------------------------------------------------------------------------

/** Single chat message in OpenAI format. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Call an Ollama Cloud model directly via the OpenAI-compatible chat completions
 * endpoint. Returns the text content of the first choice.
 *
 * This bypasses the AI SDK (which has v5 incompatibility issues) and gives full
 * control over the request — needed for the prediction engine's structured JSON
 * prompts.
 *
 * @param model   Ollama model name (e.g. "qwen3:480b", "gemma4:31b-cloud").
 * @param messages  Array of chat messages (system + user).
 * @returns The assistant's text response.
 * @throws Error if the API key is missing, the request fails, or the response
 *         is malformed.
 */
export async function callOllamaChat(
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const { baseURL, apiKey } = predictionConfig.ollama;

  if (!apiKey) {
    throw new Error(
      "OLLAMA_API_KEY is not defined — cannot call Ollama Cloud.",
    );
  }

  const url = `${baseURL}/v1/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(
      `Ollama Cloud request failed (${response.status}): ${errorText}`,
    );
  }

  const data = await response.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new TypeError(
      "Ollama Cloud returned malformed response — no choices[0].message.content.",
    );
  }

  return content;
}
