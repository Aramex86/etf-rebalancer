// src/entities/prediction/model/predictionEngine.ts

import { predictionConfig } from "@/shared/lib/predictionConfig";
import { callOllamaChat, type ChatMessage } from "@/shared/lib/ollama";
import type { Direction } from "./predictionRepository";
import type { LLMResponse, PredictionInput } from "./predictionTypes";

/** Minimum number of history points required to call the LLM (from config). */
const MIN_HISTORY_POINTS = predictionConfig.prediction.minHistoryPoints;

/** Threshold for direction classification: ±1% (from config). */
const FLAT_THRESHOLD_PCT = predictionConfig.prediction.flatThresholdPct;

/**
 * Build the system prompt for the prediction model.
 */
function buildSystemPrompt(): string {
  return `You are a financial forecasting assistant specializing in UCITS ETF price prediction.
You analyze historical price data and technical indicators to predict short-term price movements.
You always return a valid JSON object — no markdown, no extra text.`;
}

/**
 * Build the user prompt with price history + indicators.
 */
function buildUserPrompt(input: PredictionInput): string {
  const { symbol, history, sma7, sma14, volatility, high30, low30 } = input;

  const currentPrice = history.at(-1)?.close ?? 0;
  const historyJson = JSON.stringify(
    history.map((p) => ({ date: p.date, close: p.close })),
  );

  return `Analyze the following 30-day price history for UCITS ETF ${symbol}.

Current price: ${currentPrice}

Price history:
${historyJson}

Additional context:
- 7-day SMA: ${sma7.toFixed(4)}
- 14-day SMA: ${sma14.toFixed(4)}
- 30-day volatility: ${(volatility * 100).toFixed(2)}%
- 30-day high: ${high30.toFixed(4)}
- 30-day low: ${low30.toFixed(4)}

Predict the closing price exactly 7 calendar days from now.
Return ONLY a JSON object with this exact structure:
{
  "predictedPrice": number,
  "confidence": number between 0 and 1,
  "direction": "up" | "down" | "flat",
  "reasoning": "short explanation in English"
}

Rules:
- "up" means predicted price is at least 1% higher than current price.
- "down" means predicted price is at least 1% lower than current price.
- "flat" means change is within ±1%.
- Confidence should reflect data quality and trend clarity.`;
}

/**
 * Extract the first JSON object from a text string.
 * Handles cases where the LLM wraps JSON in markdown code fences.
 */
function extractJson(text: string): string | null {
  // Try direct parse first.
  try {
    JSON.parse(text);
    return text;
  } catch {
    // Continue to regex extraction.
  }

  // Extract first {...} block.
  const jsonRegex = /\{[\s\S]*\}/;
  const match = jsonRegex.exec(text);
  if (match) {
    try {
      JSON.parse(match[0]);
      return match[0];
    } catch {
      // Continue.
    }
  }

  return null;
}

/** Validate and normalise a parsed LLM response. */
function validateResponse(
  parsed: unknown,
  currentPrice: number,
): LLMResponse | null {
  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  const predictedPrice = Number(obj.predictedPrice);
  const confidence = Number(obj.confidence);
  const direction = obj.direction;
  const reasoning = obj.reasoning;

  if (
    !Number.isFinite(predictedPrice) ||
    predictedPrice <= 0 ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    (direction !== "up" && direction !== "down" && direction !== "flat") ||
    typeof reasoning !== "string"
  ) {
    return null;
  }

  // Re-classify direction to ensure consistency with the ±1% rule.
  const changePct = ((predictedPrice - currentPrice) / currentPrice) * 100;
  let correctedDirection: Direction;
  if (changePct > FLAT_THRESHOLD_PCT) correctedDirection = "up";
  else if (changePct < -FLAT_THRESHOLD_PCT) correctedDirection = "down";
  else correctedDirection = "flat";

  return {
    predictedPrice,
    confidence,
    direction: correctedDirection,
    reasoning,
  };
}

/** Fallback response when LLM is unavailable or returns invalid data. */
function fallbackResponse(currentPrice: number, reason: string): LLMResponse {
  return {
    predictedPrice: currentPrice,
    confidence: 0,
    direction: "flat",
    reasoning: `LLM unavailable: ${reason}`,
  };
}

/**
 * Run a price prediction for a single ETF.
 *
 * @param input PredictionInput with history + indicators.
 * @returns LLMResponse with predictedPrice, confidence, direction, reasoning.
 *          Falls back to current-price hold if LLM fails or history is too short.
 */
export async function predict(input: PredictionInput): Promise<LLMResponse> {
  const currentPrice = input.history.at(-1)?.close ?? 0;

  // Need at least 14 data points for a meaningful prediction.
  if (input.history.length < MIN_HISTORY_POINTS) {
    return fallbackResponse(
      currentPrice,
      `insufficient history (${input.history.length} < ${MIN_HISTORY_POINTS})`,
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(input) },
  ];

  let rawResponse: string;
  try {
    rawResponse = await callOllamaChat(
      predictionConfig.ollama.predictionModel,
      messages,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fallbackResponse(currentPrice, `Ollama call failed: ${msg}`);
  }

  const jsonStr = extractJson(rawResponse);
  if (!jsonStr) {
    return fallbackResponse(currentPrice, "no JSON found in response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return fallbackResponse(currentPrice, "invalid JSON");
  }

  const validated = validateResponse(parsed, currentPrice);
  if (!validated) {
    return fallbackResponse(currentPrice, "response failed validation");
  }

  return validated;
}
