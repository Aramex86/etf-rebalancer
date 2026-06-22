// src/entities/market-data/model/priceHistoryRepository.ts

import { query } from "@/shared/lib/db";
import type { PricePoint } from "@/shared/types/marketData";

/** Batch-insert price points for a symbol, upserting on conflict. */
export async function savePriceBatch(
  symbol: string,
  prices: PricePoint[],
): Promise<void> {
  if (prices.length === 0) return;

  // Build a single multi-row INSERT with ON CONFLICT upsert.
  const values: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  for (const point of prices) {
    values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2})`);
    params.push(symbol, point.date, point.close);
    paramIdx += 3;
  }

  await query(
    `INSERT INTO price_history (symbol, date, close)
     VALUES ${values.join(", ")}
     ON CONFLICT (symbol, date) DO UPDATE SET
       close = EXCLUDED.close`,
    params,
  );
}

/** Format a Date (from pg DATE column) as YYYY-MM-DD in local time. */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns the last N days of price history for a symbol, sorted ASC by date. */
export async function getPriceHistory(
  symbol: string,
  days: number,
): Promise<PricePoint[]> {
  const result = await query(
    `SELECT date, close
     FROM price_history
     WHERE symbol = $1
     ORDER BY date DESC
     LIMIT $2`,
    [symbol, days],
  );

  // Reverse to ASC order (we fetched DESC for LIMIT).
  return result.rows
    .map((row) => ({
      date: row.date instanceof Date ? formatDate(row.date) : String(row.date),
      close: Number(row.close),
    }))
    .reverse();
}

/** Returns the price on a specific date, or null if not found. */
export async function getPriceOnDate(
  symbol: string,
  date: string,
): Promise<PricePoint | null> {
  const result = await query(
    "SELECT date, close FROM price_history WHERE symbol = $1 AND date = $2",
    [symbol, date],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    date: row.date instanceof Date ? formatDate(row.date) : String(row.date),
    close: Number(row.close),
  };
}

/** Returns the latest date for which we have price data, or null. */
export async function getLatestPriceDate(
  symbol: string,
): Promise<string | null> {
  const result = await query(
    "SELECT MAX(date) as latest FROM price_history WHERE symbol = $1",
    [symbol],
  );

  const latest = result.rows[0]?.latest;
  if (!latest) return null;

  return latest instanceof Date ? formatDate(latest) : String(latest);
}

/**
 * Returns ALL price history for a symbol, sorted ASC by date.
 * Used by the backtest engine which needs the full 1-year series.
 */
export async function getAllPriceHistory(
  symbol: string,
): Promise<PricePoint[]> {
  const result = await query(
    "SELECT date, close FROM price_history WHERE symbol = $1 ORDER BY date ASC",
    [symbol],
  );

  return result.rows.map((row) => ({
    date:
      row.date instanceof Date
        ? row.date.toISOString().slice(0, 10)
        : String(row.date),
    close: Number(row.close),
  }));
}
