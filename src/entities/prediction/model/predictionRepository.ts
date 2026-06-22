// src/entities/prediction/model/predictionRepository.ts

import { query } from "@/shared/lib/db";

/** Direction of a price prediction. */
export type Direction = "up" | "down" | "flat";

/** Trading signal derived from prediction. */
export type Signal = "buy" | "sell" | "hold";

/** Full prediction record as stored in the database. */
export interface PredictionRecord {
  id: number;
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
  actualPrice: number | null;
  actualDirection: Direction | null;
  directionCorrect: boolean | null;
  errorPct: number | null;
  mape: number | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

/** Input for saving a new prediction (id and verification fields are set by DB). */
export interface PredictionInput {
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
}

/** Result of verifying a prediction against the actual price. */
export interface VerificationResult {
  actualPrice: number;
  actualDirection: Direction;
  directionCorrect: boolean;
  errorPct: number;
  mape: number;
}

/** Format a date-like DB value as YYYY-MM-DD. */
function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value;
  return "";
}

/** Map a raw DB row to a PredictionRecord. */
function mapRow(row: Record<string, unknown>): PredictionRecord {
  return {
    id: Number(row.id),
    symbol: row.symbol as string,
    targetDate: formatDate(row.target_date),
    horizonDays: Number(row.horizon_days),
    currency: (row.currency as string) ?? null,
    currentPrice: Number(row.current_price),
    predictedPrice: Number(row.predicted_price),
    confidence: row.confidence !== null ? Number(row.confidence) : null,
    direction: row.direction as Direction,
    reasoning: (row.reasoning as string) ?? null,
    afterTaxReturnPct:
      row.after_tax_return_pct !== null
        ? Number(row.after_tax_return_pct)
        : null,
    signal: (row.signal as Signal) ?? null,
    alternativeSymbol: (row.alternative_symbol as string) ?? null,
    alternativeAfterTaxReturnPct:
      row.alternative_after_tax_return_pct !== null
        ? Number(row.alternative_after_tax_return_pct)
        : null,
    baselinePredictedPrice:
      row.baseline_predicted_price !== null
        ? Number(row.baseline_predicted_price)
        : null,
    baselineDirection: (row.baseline_direction as Direction) ?? null,
    actualPrice: row.actual_price !== null ? Number(row.actual_price) : null,
    actualDirection: (row.actual_direction as Direction) ?? null,
    directionCorrect:
      row.direction_correct !== null ? Boolean(row.direction_correct) : null,
    errorPct: row.error_pct !== null ? Number(row.error_pct) : null,
    mape: row.mape !== null ? Number(row.mape) : null,
    verifiedAt: row.verified_at ? new Date(row.verified_at as string) : null,
    createdAt: new Date(row.created_at as string),
  };
}

/** Save a new prediction, returns the generated id. */
export async function savePrediction(p: PredictionInput): Promise<number> {
  const result = await query(
    `INSERT INTO predictions
       (symbol, target_date, horizon_days, currency, current_price, predicted_price,
        confidence, direction, reasoning, after_tax_return_pct, signal,
        alternative_symbol, alternative_after_tax_return_pct,
        baseline_predicted_price, baseline_direction, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
     RETURNING id`,
    [
      p.symbol,
      p.targetDate,
      p.horizonDays,
      p.currency,
      p.currentPrice,
      p.predictedPrice,
      p.confidence,
      p.direction,
      p.reasoning,
      p.afterTaxReturnPct,
      p.signal,
      p.alternativeSymbol,
      p.alternativeAfterTaxReturnPct,
      p.baselinePredictedPrice,
      p.baselineDirection,
    ],
  );
  return Number(result.rows[0].id);
}

/**
 * Returns the latest prediction per symbol (one row per symbol).
 * JOINs with watchlist for category info.
 */
export async function getLatestPredictions(
  limit: number,
): Promise<PredictionRecord[]> {
  const result = await query(
    `SELECT DISTINCT ON (p.symbol)
        p.id, p.symbol, p.target_date, p.horizon_days, p.currency,
        p.current_price, p.predicted_price, p.confidence, p.direction,
        p.reasoning, p.after_tax_return_pct, p.signal,
        p.alternative_symbol, p.alternative_after_tax_return_pct,
        p.baseline_predicted_price, p.baseline_direction,
        p.actual_price, p.actual_direction, p.direction_correct,
        p.error_pct, p.mape, p.verified_at, p.created_at
     FROM predictions p
     ORDER BY p.symbol, p.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(mapRow);
}

/** Returns predictions where target_date has passed but not yet verified. */
export async function getUnverifiedPredictions(): Promise<PredictionRecord[]> {
  const result = await query(
    `SELECT * FROM predictions
     WHERE verified_at IS NULL AND target_date <= CURRENT_DATE
     ORDER BY target_date ASC`,
  );
  return result.rows.map(mapRow);
}

/** Returns predictions for a specific symbol, newest first. */
export async function getPredictionsBySymbol(
  symbol: string,
  limit: number,
): Promise<PredictionRecord[]> {
  const result = await query(
    `SELECT * FROM predictions
     WHERE symbol = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [symbol, limit],
  );
  return result.rows.map(mapRow);
}

/** Mark a prediction as verified with the actual price and accuracy metrics. */
export async function markVerified(
  id: number,
  actual: VerificationResult,
): Promise<void> {
  await query(
    `UPDATE predictions SET
       actual_price = $2,
       actual_direction = $3,
       direction_correct = $4,
       error_pct = $5,
       mape = $6,
       verified_at = NOW()
     WHERE id = $1`,
    [
      id,
      actual.actualPrice,
      actual.actualDirection,
      actual.directionCorrect,
      actual.errorPct,
      actual.mape,
    ],
  );
}
