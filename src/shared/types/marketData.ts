// src/shared/types/marketData.ts

/**
 * A single price point in a historical price series.
 *
 * Lives in `shared/types/` because it is needed by both
 * `entities/market-data` and `entities/prediction` — FSAA forbids
 * cross-entity imports, so shared types go in the shared layer.
 */
export interface PricePoint {
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  /** Closing price. */
  close: number;
}
