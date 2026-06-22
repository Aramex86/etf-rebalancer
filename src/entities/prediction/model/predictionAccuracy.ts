// src/entities/prediction/model/predictionAccuracy.ts

import type {
  Direction,
  PredictionRecord,
  VerificationResult,
} from "./predictionRepository";
import type { AccuracyStats } from "./predictionTypes";
import { getPredictionsBySymbol } from "./predictionRepository";

/** ±1% threshold for actual direction classification. */
const FLAT_THRESHOLD_PCT = 1;

/**
 * Classify actual price movement into up/down/flat (±1%).
 */
function classifyActualDirection(
  currentPrice: number,
  actualPrice: number,
): Direction {
  const changePct = ((actualPrice - currentPrice) / currentPrice) * 100;
  if (changePct > FLAT_THRESHOLD_PCT) return "up";
  if (changePct < -FLAT_THRESHOLD_PCT) return "down";
  return "flat";
}

/**
 * Verify a prediction against the actual price.
 *
 * @param prediction  The prediction record to verify.
 * @param actualPrice The actual price on the target date.
 * @returns VerificationResult with directionCorrect, errorPct, mape.
 */
export function verifyPrediction(
  prediction: PredictionRecord,
  actualPrice: number,
): VerificationResult {
  const actualDirection = classifyActualDirection(
    prediction.currentPrice,
    actualPrice,
  );

  const directionCorrect = prediction.direction === actualDirection;

  const errorPct =
    ((actualPrice - prediction.predictedPrice) / prediction.predictedPrice) *
    100;

  const mape = Math.abs(errorPct);

  return {
    actualPrice,
    actualDirection,
    directionCorrect,
    errorPct,
    mape,
  };
}

/**
 * Calculate accuracy statistics for a set of prediction records.
 * Pure function — no DB access.
 */
export function calcAccuracyStats(records: PredictionRecord[]): AccuracyStats {
  const total = records.length;

  if (total === 0) {
    return { total: 0, directionCorrect: 0, accuracy: 0, avgMape: 0 };
  }

  const directionCorrect = records.filter(
    (r) => r.directionCorrect === true,
  ).length;

  const mapeSum = records.reduce((sum, r) => sum + (r.mape ?? 0), 0);

  return {
    total,
    directionCorrect,
    accuracy: directionCorrect / total,
    avgMape: mapeSum / total,
  };
}

/**
 * Get accuracy stats for a specific symbol from the database.
 * @param symbol  ETF symbol.
 * @param lastN   Number of recent verified predictions to consider.
 */
export async function getAccuracyBySymbol(
  symbol: string,
  lastN = 20,
): Promise<AccuracyStats> {
  const records = await getPredictionsBySymbol(symbol, lastN);

  // Only count verified predictions.
  const verified = records.filter((r) => r.verifiedAt !== null);

  return calcAccuracyStats(verified);
}

/** Re-export PricePoint for convenience (used by verify endpoint). */
export type { PricePoint } from "@/shared/types/marketData";
