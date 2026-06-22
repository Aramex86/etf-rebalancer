// src/entities/market-data/model/watchlistRepository.ts

import { query } from "@/shared/lib/db";

/** A single ETF in the prediction watchlist. */
export interface WatchlistItem {
  id: number;
  symbol: string;
  yahooSymbol: string;
  name: string;
  category: string;
  currency: string;
  /** Distribution policy: "acc" (accumulating) or "dist" (distributing). */
  distPolicy: "acc" | "dist";
  /** Array of alternative ETF symbols. */
  alternatives: string[];
  isActive: boolean;
}

/** Input for upsert — id is optional (auto-assigned on insert). */
export interface WatchlistItemInput {
  symbol: string;
  yahooSymbol: string;
  name: string;
  category?: string;
  currency?: string;
  distPolicy?: "acc" | "dist";
  alternatives?: string[];
  isActive?: boolean;
}

/** Map a raw DB row to a WatchlistItem. */
function mapRow(row: Record<string, unknown>): WatchlistItem {
  return {
    id: Number(row.id),
    symbol: row.symbol as string,
    yahooSymbol: row.yahoo_symbol as string,
    name: row.name as string,
    category: row.category as string,
    currency: row.currency as string,
    distPolicy: row.dist_policy as "acc" | "dist",
    alternatives: (row.alternatives as string[]) ?? [],
    isActive: Boolean(row.is_active),
  };
}

/** Returns all active watchlist items, ordered by symbol. */
export async function getActiveWatchlist(): Promise<WatchlistItem[]> {
  const result = await query(
    "SELECT * FROM watchlist WHERE is_active = TRUE ORDER BY symbol",
  );
  return result.rows.map(mapRow);
}

/** Returns a single watchlist item by its base symbol (e.g. "SWRD"). */
export async function getWatchlistBySymbol(
  symbol: string,
): Promise<WatchlistItem | null> {
  const result = await query("SELECT * FROM watchlist WHERE symbol = $1", [
    symbol,
  ]);
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

/**
 * Insert or update a watchlist item by symbol.
 * Idempotent — safe to call multiple times for seeding.
 */
export async function upsertWatchlistItem(
  item: WatchlistItemInput,
): Promise<void> {
  await query(
    `INSERT INTO watchlist
       (symbol, yahoo_symbol, name, category, currency, dist_policy, alternatives, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (symbol) DO UPDATE SET
       yahoo_symbol = EXCLUDED.yahoo_symbol,
       name = EXCLUDED.name,
       category = EXCLUDED.category,
       currency = EXCLUDED.currency,
       dist_policy = EXCLUDED.dist_policy,
       alternatives = EXCLUDED.alternatives,
       is_active = EXCLUDED.is_active,
       updated_at = NOW()`,
    [
      item.symbol,
      item.yahooSymbol,
      item.name,
      item.category ?? "equity",
      item.currency ?? "USD",
      item.distPolicy ?? "acc",
      item.alternatives ?? [],
      item.isActive ?? true,
    ],
  );
}
