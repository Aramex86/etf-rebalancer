// src/entities/backtest/model/backtestRepository.ts

import { query } from "@/shared/lib/db";
import type {
  BacktestRunRecord,
  BacktestSnapshotRecord,
  BacktestTradeRecord,
  BacktestSummary,
  RunStatus,
  RunListItem,
  SimulationParams,
  SnapshotPosition,
} from "./backtestTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date (from pg TIMESTAMP) as ISO string. */
function formatTimestamp(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : String(date);
}

/** Format a Date (from pg DATE column) as YYYY-MM-DD. */
function formatDate(date: Date | string): string {
  if (date instanceof Date) {
    return date.toISOString().slice(0, 10);
  }
  return String(date);
}

/** Parse positions JSONB from DB. */
function parsePositions(positions: unknown): SnapshotPosition[] {
  if (!Array.isArray(positions)) return [];
  return positions as SnapshotPosition[];
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

/** Create a new backtest run. Returns the runId. */
export async function createRun(
  runId: string,
  model: string,
  params: SimulationParams,
  startValue: number,
  totalWeeks: number,
): Promise<void> {
  await query(
    `INSERT INTO backtest_runs (run_id, model, status, params, start_value, total_weeks, current_week)
     VALUES ($1, $2, 'running', $3, $4, $5, 0)`,
    [runId, model, JSON.stringify(params), startValue, totalWeeks],
  );
}

/** Get a run by runId. Returns null if not found. */
export async function getRun(runId: string): Promise<BacktestRunRecord | null> {
  const result = await query("SELECT * FROM backtest_runs WHERE run_id = $1", [
    runId,
  ]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    runId: row.run_id,
    model: row.model,
    status: row.status as RunStatus,
    params:
      typeof row.params === "string"
        ? (JSON.parse(row.params) as SimulationParams)
        : (row.params as SimulationParams),
    startValue: Number(row.start_value),
    endValue: row.end_value !== null ? Number(row.end_value) : null,
    totalReturnPct:
      row.total_return_pct !== null ? Number(row.total_return_pct) : null,
    buyHoldReturnPct:
      row.buy_hold_return_pct !== null ? Number(row.buy_hold_return_pct) : null,
    sharpeRatio: row.sharpe_ratio !== null ? Number(row.sharpe_ratio) : null,
    maxDrawdownPct:
      row.max_drawdown_pct !== null ? Number(row.max_drawdown_pct) : null,
    winRate: row.win_rate !== null ? Number(row.win_rate) : null,
    totalTrades: row.total_trades ?? 0,
    profitableTrades: row.profitable_trades ?? 0,
    totalCommission: Number(row.total_commission ?? 0),
    totalTax: Number(row.total_tax ?? 0),
    currentWeek: row.current_week ?? 0,
    totalWeeks: row.total_weeks ?? 0,
    errorMessage: row.error_message ?? null,
    createdAt: formatTimestamp(row.created_at) ?? "",
    completedAt: formatTimestamp(row.completed_at),
  };
}

/** List all runs, newest first. */
export async function listRuns(limit = 50): Promise<RunListItem[]> {
  const result = await query(
    `SELECT run_id, model, status, total_return_pct, buy_hold_return_pct,
            total_trades, created_at
     FROM backtest_runs
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => {
    const totalReturn =
      row.total_return_pct !== null ? Number(row.total_return_pct) : null;
    const buyHold =
      row.buy_hold_return_pct !== null ? Number(row.buy_hold_return_pct) : null;
    return {
      runId: row.run_id,
      model: row.model,
      status: row.status as RunStatus,
      totalReturnPct: totalReturn,
      buyHoldReturnPct: buyHold,
      vsBuyHoldDeltaPct:
        totalReturn !== null && buyHold !== null ? totalReturn - buyHold : null,
      totalTrades: row.total_trades ?? 0,
      createdAt: formatTimestamp(row.created_at) ?? "",
    };
  });
}

/** Update run status and current week. */
export async function updateRunProgress(
  runId: string,
  week: number,
  status?: RunStatus,
): Promise<void> {
  if (status) {
    await query(
      "UPDATE backtest_runs SET current_week = $1, status = $2 WHERE run_id = $3",
      [week, status, runId],
    );
  } else {
    await query(
      "UPDATE backtest_runs SET current_week = $1 WHERE run_id = $2",
      [week, runId],
    );
  }
}

/** Finalize a run with summary metrics. */
export async function finalizeRun(
  runId: string,
  summary: BacktestSummary,
): Promise<void> {
  await query(
    `UPDATE backtest_runs SET
       status = 'done',
       end_value = $1,
       total_return_pct = $2,
       buy_hold_return_pct = $3,
       sharpe_ratio = $4,
       max_drawdown_pct = $5,
       win_rate = $6,
       total_trades = $7,
       profitable_trades = $8,
       total_commission = $9,
       total_tax = $10,
       completed_at = NOW()
     WHERE run_id = $11`,
    [
      summary.endValue,
      summary.totalReturnPct,
      summary.buyHoldReturnPct,
      summary.sharpeRatio,
      summary.maxDrawdownPct,
      summary.winRate,
      summary.totalTrades,
      summary.profitableTrades,
      summary.totalCommission,
      summary.totalTax,
      runId,
    ],
  );
}

/** Mark a run as failed with an error message. */
export async function failRun(
  runId: string,
  errorMessage: string,
): Promise<void> {
  await query(
    "UPDATE backtest_runs SET status = 'failed', error_message = $1 WHERE run_id = $2",
    [errorMessage, runId],
  );
}

/** Delete a run and all its trades and snapshots. */
export async function deleteRun(runId: string): Promise<void> {
  await query("DELETE FROM backtest_trades WHERE run_id = $1", [runId]);
  await query("DELETE FROM backtest_snapshots WHERE run_id = $1", [runId]);
  await query("DELETE FROM backtest_runs WHERE run_id = $1", [runId]);
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

/** Insert a trade record. */
export async function insertTrade(
  trade: Omit<BacktestTradeRecord, "id">,
): Promise<void> {
  await query(
    `INSERT INTO backtest_trades
       (run_id, week, date, symbol, action, shares, price, amount_usd,
        commission, tax, realized_pnl, cash_after)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      trade.runId,
      trade.week,
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
    ],
  );
}

/** Get all trades for a run, ordered by week. */
export async function getTradesByRun(
  runId: string,
): Promise<BacktestTradeRecord[]> {
  const result = await query(
    `SELECT * FROM backtest_trades WHERE run_id = $1 ORDER BY week ASC, id ASC`,
    [runId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    runId: row.run_id,
    week: row.week,
    date: formatDate(row.date),
    symbol: row.symbol,
    action: row.action as "buy" | "sell",
    shares: row.shares,
    price: Number(row.price),
    amountUsd: Number(row.amount_usd),
    commission: Number(row.commission),
    tax: row.tax !== null ? Number(row.tax) : null,
    realizedPnl: row.realized_pnl !== null ? Number(row.realized_pnl) : null,
    cashAfter: Number(row.cash_after),
  }));
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

/** Insert a snapshot record. */
export async function insertSnapshot(
  snapshot: Omit<BacktestSnapshotRecord, "id">,
): Promise<void> {
  await query(
    `INSERT INTO backtest_snapshots
       (run_id, week, date, cash, positions, total_value)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (run_id, week) DO UPDATE SET
       cash = EXCLUDED.cash,
       positions = EXCLUDED.positions,
       total_value = EXCLUDED.total_value`,
    [
      snapshot.runId,
      snapshot.week,
      snapshot.date,
      snapshot.cash,
      JSON.stringify(snapshot.positions),
      snapshot.totalValue,
    ],
  );
}

/** Get all snapshots for a run, ordered by week. */
export async function getSnapshotsByRun(
  runId: string,
): Promise<BacktestSnapshotRecord[]> {
  const result = await query(
    `SELECT * FROM backtest_snapshots WHERE run_id = $1 ORDER BY week ASC`,
    [runId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    runId: row.run_id,
    week: row.week,
    date: formatDate(row.date),
    cash: Number(row.cash),
    positions: parsePositions(row.positions),
    totalValue: Number(row.total_value),
  }));
}

/** Get the latest snapshot week for a run (for resumption). Returns -1 if none. */
export async function getLatestSnapshotWeek(runId: string): Promise<number> {
  const result = await query(
    "SELECT MAX(week) as max_week FROM backtest_snapshots WHERE run_id = $1",
    [runId],
  );
  const maxWeek = result.rows[0]?.max_week;
  return maxWeek !== null && maxWeek !== undefined ? Number(maxWeek) : -1;
}
