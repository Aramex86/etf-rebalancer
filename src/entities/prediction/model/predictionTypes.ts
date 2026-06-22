// src/entities/prediction/model/predictionTypes.ts

import type { PricePoint } from "@/shared/types/marketData";
import type { Direction, Signal } from "./predictionRepository";

/** Input for the prediction engine — history + pre-computed indicators. */
export interface PredictionInput {
  symbol: string;
  /** Price history sorted ascending (oldest first), typically 30 days. */
  history: PricePoint[];
  /** 7-day Simple Moving Average. */
  sma7: number;
  /** 14-day Simple Moving Average. */
  sma14: number;
  /** Annualised volatility (std dev of daily returns). */
  volatility: number;
  /** 30-day high. */
  high30: number;
  /** 30-day low. */
  low30: number;
}

/** Raw LLM response — parsed JSON from the prediction model. */
export interface LLMResponse {
  predictedPrice: number;
  /** Confidence in [0, 1]. */
  confidence: number;
  direction: Direction;
  /** Human-readable reasoning (Russian). */
  reasoning: string;
}

/** Full prediction result — LLM response enriched with tax + signal + baseline. */
export interface PredictionResult extends LLMResponse {
  symbol: string;
  /** Current price at prediction time. */
  currentPrice: number;
  /** After-tax return percentage (Moldova resident). */
  afterTaxReturnPct: number;
  /** Trading signal derived from direction + afterTaxReturnPct. */
  signal: Signal;
  /** Best alternative symbol (if any). */
  alternativeSymbol: string | null;
  /** After-tax return of the best alternative. */
  alternativeAfterTaxReturnPct: number | null;
  /** Baseline (SMA-drift) predicted price for comparison. */
  baselinePredictedPrice: number;
  /** Baseline direction. */
  baselineDirection: Direction;
}

/** Accuracy statistics for a set of predictions. */
export interface AccuracyStats {
  total: number;
  directionCorrect: number;
  /** accuracy = directionCorrect / total (0 if total === 0). */
  accuracy: number;
  /** Average Mean Absolute Percentage Error. */
  avgMape: number;
}

/** Re-export Direction and Signal for convenience. */
export type { Direction, Signal };
