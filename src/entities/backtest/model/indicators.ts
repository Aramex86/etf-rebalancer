// src/entities/backtest/model/indicators.ts

import type { PricePoint } from "@/shared/types/marketData";

// ---------------------------------------------------------------------------
// SMA — Simple Moving Average
// ---------------------------------------------------------------------------

/**
 * Compute the Simple Moving Average over the last `period` data points.
 * Returns 0 if not enough data.
 */
export function sma(history: PricePoint[], period: number): number {
  if (history.length < period) return 0;
  const slice = history.slice(-period);
  return slice.reduce((sum, p) => sum + p.close, 0) / period;
}

// ---------------------------------------------------------------------------
// Volatility — annualised standard deviation of daily returns
// ---------------------------------------------------------------------------

/**
 * Compute annualised volatility from daily returns.
 * @param history Price history (ascending by date).
 * @param period Number of recent days to use (default 30).
 * @returns Volatility as a fraction (e.g. 0.15 = 15%).
 */
export function volatility(history: PricePoint[], period = 30): number {
  if (history.length < 2) return 0;

  const slice = history.slice(-period);
  const returns: number[] = [];

  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1].close;
    const curr = slice[i].close;
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }

  if (returns.length < 2) return 0;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Annualise: √252 trading days.
  return stdDev * Math.sqrt(252);
}

// ---------------------------------------------------------------------------
// High / Low over a period
// ---------------------------------------------------------------------------

/** Highest closing price over the last `period` days. */
export function highOver(history: PricePoint[], period = 30): number {
  const slice = history.slice(-period);
  if (slice.length === 0) return 0;
  return Math.max(...slice.map((p) => p.close));
}

/** Lowest closing price over the last `period` days. */
export function lowOver(history: PricePoint[], period = 30): number {
  const slice = history.slice(-period);
  if (slice.length === 0) return 0;
  return Math.min(...slice.map((p) => p.close));
}

// ---------------------------------------------------------------------------
// RSI — Relative Strength Index (Wilder's smoothing)
// ---------------------------------------------------------------------------

/**
 * Compute the RSI (Relative Strength Index) using Wilder's smoothing method.
 *
 * RSI = 100 - (100 / (1 + RS))
 * RS = average gain / average loss over the period.
 *
 * @param history Price history (ascending by date).
 * @param period RSI period (default 14).
 * @returns RSI value in [0, 100]. Returns 50 (neutral) if not enough data.
 */
export function rsi(history: PricePoint[], period = 14): number {
  if (history.length < period + 1) return 50;

  // Compute daily price changes.
  const changes: number[] = [];
  const slice = history.slice(-(period + 1));
  for (let i = 1; i < slice.length; i++) {
    changes.push(slice[i].close - slice[i - 1].close);
  }

  // Initial average gain / loss (simple average over the period).
  let avgGain = 0;
  let avgLoss = 0;

  for (const change of changes) {
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) return 100; // All gains → overbought.
  if (avgGain === 0) return 0; // All losses → oversold.

  // Wilder's smoothing: subsequent values use previous avg.
  // For a single computation from the last period+1 points, the simple
  // average is sufficient and standard for a point-in-time RSI.
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ---------------------------------------------------------------------------
// Compute all indicators for a single ETF at a point in time
// ---------------------------------------------------------------------------

import type { MarketContext } from "./backtestTypes";

/**
 * Compute all market indicators for a symbol from its price history.
 * @param symbol ETF symbol.
 * @param history Price history (ascending by date), at least 30 points recommended.
 * @returns MarketContext with current price + all indicators.
 */
export function computeMarketContext(
  symbol: string,
  history: PricePoint[],
): MarketContext {
  const currentPrice = history.at(-1)?.close ?? 0;

  return {
    symbol,
    currentPrice,
    sma7: sma(history, 7),
    sma14: sma(history, 14),
    rsi14: rsi(history, 14),
    volatility: volatility(history, 30),
    high30: highOver(history, 30),
    low30: lowOver(history, 30),
  };
}
