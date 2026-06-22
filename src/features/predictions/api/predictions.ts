// src/features/predictions/api/predictions.ts

import type {
  PredictionRecord,
  Direction,
  Signal,
} from "@/entities/prediction";

/** Prediction row as returned by GET /api/predictions (with accuracy enrichment). */
export interface PredictionWithAccuracy extends PredictionRecord {
  /** Direction accuracy over last N verified predictions (0-1). */
  accuracy: number;
  /** Average MAPE over last N verified predictions. */
  avgMape: number;
}

/** Response shape from GET /api/predictions. */
interface GetPredictionsResponse {
  predictions: PredictionWithAccuracy[];
  count: number;
}

/** Response shape from POST /api/predictions. */
interface CreatePredictionsResponse {
  predictions: Array<{
    symbol: string;
    targetDate: string;
    horizonDays: number;
    currency: string | null;
    currentPrice: number;
    predictedPrice: number;
    confidence: number | null;
    direction: Direction;
    reasoning: string | null;
    afterTaxReturnPct: number | null;
    signal: Signal | null;
    alternativeSymbol: string | null;
    alternativeAfterTaxReturnPct: number | null;
    baselinePredictedPrice: number | null;
    baselineDirection: Direction | null;
  }>;
  count: number;
  savedIds: number[];
}

/**
 * Fetch latest predictions with accuracy stats.
 * @param limit Max number of predictions (default 50, max 100).
 */
export async function fetchPredictions(
  limit = 50,
): Promise<PredictionWithAccuracy[]> {
  const response = await fetch(`/api/predictions?limit=${limit}`);

  if (!response.ok) {
    throw new Error("Failed to fetch predictions");
  }

  const data: GetPredictionsResponse = await response.json();
  return data.predictions;
}

/**
 * Run the full prediction pipeline for all watchlist ETFs.
 * Returns the newly created predictions.
 *
 * Note: parallel LLM calls + Vercel 60s timeout. Client waits up to 55s.
 */
export async function createPredictions(): Promise<CreatePredictionsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch("/api/predictions", {
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("Failed to generate predictions");
    }

    return response.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        "Генерация заняла больше 55 секунд. Попробуйте ещё раз — данные уже могли сохраниться.",
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
