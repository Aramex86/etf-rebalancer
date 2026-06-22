// src/entities/prediction/model/predictionBaselines.ts

import type { PricePoint } from "@/shared/types/marketData";
import type { Direction } from "./predictionRepository";
import { predictionConfig } from "@/shared/lib/predictionConfig";

/** Threshold for direction classification: ±1% change → "flat" (from config). */
const FLAT_THRESHOLD_PCT = predictionConfig.prediction.flatThresholdPct;

/**
 * Classify a price change as up / down / flat.
 * @param currentPrice  Current price.
 * @param predictedPrice Predicted price.
 * @returns Direction string.
 */
function classifyDirection(
  currentPrice: number,
  predictedPrice: number,
): Direction {
  const changePct = ((predictedPrice - currentPrice) / currentPrice) * 100;
  if (changePct > FLAT_THRESHOLD_PCT) return "up";
  if (changePct < -FLAT_THRESHOLD_PCT) return "down";
  return "flat";
}

/**
 * Random-walk baseline: predicted price = current price.
 * This is the "no-change" null hypothesis — any model must beat this.
 */
export function randomWalkBaseline(currentPrice: number): {
  predictedPrice: number;
  direction: Direction;
} {
  return {
    predictedPrice: currentPrice,
    direction: classifyDirection(currentPrice, currentPrice),
  };
}

/**
 * SMA-drift baseline: extrapolate the 7-day Simple Moving Average drift.
 *
 * 1. Compute SMA-7 over the last 7 data points.
 * 2. Compute the drift (slope) between SMA-7 today and SMA-7 `horizonDays` ago.
 * 3. Extrapolate: predictedPrice = lastClose + drift * horizonDays.
 *
 * Falls back to random walk if not enough history.
 *
 * @param history Price history sorted ascending by date (oldest first).
 * @param horizonDays Number of days to extrapolate forward.
 */
export function smaDriftBaseline(
  history: PricePoint[],
  horizonDays: number,
): { predictedPrice: number; direction: Direction } {
  const lastClose = history.at(-1)?.close;
  if (lastClose === undefined || history.length < 14) {
    return randomWalkBaseline(lastClose ?? 0);
  }

  // SMA-7 for the most recent 7 days.
  const recentSlice = history.slice(-7);
  const smaNow =
    recentSlice.reduce((sum, p) => sum + p.close, 0) / recentSlice.length;

  // SMA-7 from `horizonDays` positions back (if available).
  const offsetIndex = history.length - 7 - horizonDays;
  if (offsetIndex < 0) {
    // Not enough history for drift — use SMA as prediction.
    return {
      predictedPrice: smaNow,
      direction: classifyDirection(lastClose, smaNow),
    };
  }

  const olderSlice = history.slice(offsetIndex, offsetIndex + 7);
  const smaPast =
    olderSlice.reduce((sum, p) => sum + p.close, 0) / olderSlice.length;

  const drift = (smaNow - smaPast) / horizonDays;
  const predictedPrice = lastClose + drift * horizonDays;

  return {
    predictedPrice,
    direction: classifyDirection(lastClose, predictedPrice),
  };
}
