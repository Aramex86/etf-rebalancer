// src/entities/backtest/model/liveTradingRepository.ts

import { query } from "@/shared/lib/db";

/** Virtual portfolio for live paper trading. */
export interface LivePortfolio {
  cash: number;
  positions: Array<{
    symbol: string;
    shares: number;
    avgPrice: number;
  }>;
  startingCapital: number;
  updatedAt: string | null;
}

/** Trade record for live paper trading. */
export interface LiveTradeRecord {
  id: number;
  date: string;
  symbol: string;
  action: "buy" | "sell";
  shares: number;
  price: number;
  amountUsd: number;
  commission: number;
  tax: number | null;
  realizedPnl: number | null;
  cashAfter: number;
  reasoning: string | null;
  createdAt: string;
}

/** Snapshot of live portfolio on a given date. */
export interface LiveSnapshotRecord {
  id: number;
  date: string;
  cash: number;
  positions: Array<{
    symbol: string;
    shares: number;
    avgPrice: number;
    marketValue: number;
    unrealizedPnl: number;
  }>;
  totalValue: number;
}

/** Format a Date from pg as YYYY-MM-DD. */
function formatDate(date: Date | string): string {
  if (date instanceof Date) {
    return date.toISOString().slice(0, 10);
  }
  return String(date);
}

/** Format a timestamp from pg as ISO string. */
function formatTimestamp(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : String(date);
}

/** Get the current live portfolio, or create with default capital. */
export async function getLivePortfolio(
  defaultCapital = 1000,
): Promise<LivePortfolio> {
  const result = await query(
    "SELECT cash, positions, starting_capital, updated_at FROM live_portfolio ORDER BY id LIMIT 1",
  );

  if (result.rows.length === 0) {
    // Create initial portfolio.
    await query(
      `INSERT INTO live_portfolio (cash, positions, starting_capital)
       VALUES ($1, '[]', $1)`,
      [defaultCapital],
    );
    return {
      cash: defaultCapital,
      positions: [],
      startingCapital: defaultCapital,
      updatedAt: null,
    };
  }

  const row = result.rows[0];
  return {
    cash: Number(row.cash),
    positions: Array.isArray(row.positions) ? row.positions : [],
    startingCapital: Number(row.starting_capital),
    updatedAt: formatTimestamp(row.updated_at),
  };
}

/** Reset the live portfolio to a new starting capital. */
export async function resetLivePortfolio(
  startingCapital: number,
): Promise<LivePortfolio> {
  // Delete all existing data.
  await query("DELETE FROM live_trades");
  await query("DELETE FROM live_snapshots");

  // Upsert the single portfolio row.
  const existing = await query(
    "SELECT id FROM live_portfolio ORDER BY id LIMIT 1",
  );
  if (existing.rows.length > 0) {
    await query(
      `UPDATE live_portfolio SET cash = $1, positions = '[]', starting_capital = $1, updated_at = NOW() WHERE id = $2`,
      [startingCapital, existing.rows[0].id],
    );
  } else {
    await query(
      `INSERT INTO live_portfolio (cash, positions, starting_capital) VALUES ($1, '[]', $1)`,
      [startingCapital],
    );
  }

  return {
    cash: startingCapital,
    positions: [],
    startingCapital,
    updatedAt: new Date().toISOString(),
  };
}

/** Update the live portfolio (cash + positions). */
export async function updateLivePortfolio(
  cash: number,
  positions: Array<{ symbol: string; shares: number; avgPrice: number }>,
): Promise<void> {
  const existing = await query(
    "SELECT id FROM live_portfolio ORDER BY id LIMIT 1",
  );
  if (existing.rows.length > 0) {
    await query(
      `UPDATE live_portfolio SET cash = $1, positions = $2, updated_at = NOW() WHERE id = $3`,
      [cash, JSON.stringify(positions), existing.rows[0].id],
    );
  } else {
    await query(
      `INSERT INTO live_portfolio (cash, positions, starting_capital) VALUES ($1, $2, $1)`,
      [cash, JSON.stringify(positions)],
    );
  }
}

/** Insert a live trade record. */
export async function insertLiveTrade(trade: {
  date: string;
  symbol: string;
  action: "buy" | "sell";
  shares: number;
  price: number;
  amountUsd: number;
  commission: number;
  tax: number | null;
  realizedPnl: number | null;
  cashAfter: number;
  reasoning: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO live_trades
       (date, symbol, action, shares, price, amount_usd, commission, tax, realized_pnl, cash_after, reasoning)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      trade.date,
      trade.symbol,
      trade.action,
      trade.shares,
      trade.price,
      trade.amountUsd,
      trade.commission,
      trade.tax,
      trade.realizedPnl,
      trade.cashAfter,
      trade.reasoning,
    ],
  );
}

/** Insert or update a daily snapshot. */
export async function upsertLiveSnapshot(snap: {
  date: string;
  cash: number;
  positions: unknown;
  totalValue: number;
}): Promise<void> {
  await query(
    `INSERT INTO live_snapshots (date, cash, positions, total_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (date) DO UPDATE SET
       cash = EXCLUDED.cash,
       positions = EXCLUDED.positions,
       total_value = EXCLUDED.total_value`,
    [snap.date, snap.cash, JSON.stringify(snap.positions), snap.totalValue],
  );
}

/** List recent live trades (newest first). */
export async function listLiveTrades(limit = 50): Promise<LiveTradeRecord[]> {
  const result = await query(
    `SELECT id, date, symbol, action, shares, price, amount_usd,
            commission, tax, realized_pnl, cash_after, reasoning, created_at
     FROM live_trades
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    date: formatDate(row.date),
    symbol: row.symbol,
    action: row.action,
    shares: row.shares,
    price: Number(row.price),
    amountUsd: Number(row.amount_usd),
    commission: Number(row.commission),
    tax: row.tax !== null ? Number(row.tax) : null,
    realizedPnl: row.realized_pnl !== null ? Number(row.realized_pnl) : null,
    cashAfter: Number(row.cash_after),
    reasoning: row.reasoning ?? null,
    createdAt: formatTimestamp(row.created_at) ?? "",
  }));
}

/** List all daily snapshots (oldest first). */
export async function listLiveSnapshots(
  limit = 365,
): Promise<LiveSnapshotRecord[]> {
  const result = await query(
    `SELECT id, date, cash, positions, total_value
     FROM live_snapshots
     ORDER BY date ASC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    date: formatDate(row.date),
    cash: Number(row.cash),
    positions: Array.isArray(row.positions) ? row.positions : [],
    totalValue: Number(row.total_value),
  }));
}
