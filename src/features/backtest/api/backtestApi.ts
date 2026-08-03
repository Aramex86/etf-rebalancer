// src/features/backtest/api/backtestApi.ts

"use client";

import type {
  StartRunRequest,
  StartRunResponse,
  StepResponse,
  FinishRunResponse,
  RunListItem,
  RunDetailResponse,
} from "@/entities/backtest";

/**
 * Start a new backtest run.
 * POST /api/backtest/start
 */
export async function startRun(
  req: StartRunRequest,
): Promise<StartRunResponse> {
  const res = await fetch("/api/backtest/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Execute a single simulation step.
 * POST /api/backtest/step?runId=xxx&week=N
 */
export async function runStepRequest(
  runId: string,
  week: number,
): Promise<StepResponse> {
  const res = await fetch(
    `/api/backtest/step?runId=${encodeURIComponent(runId)}&week=${week}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Finish a run — calculate final metrics and mark as done.
 * POST /api/backtest/finish?runId=xxx
 */
export async function finishRun(runId: string): Promise<FinishRunResponse> {
  const res = await fetch(
    `/api/backtest/finish?runId=${encodeURIComponent(runId)}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * List all backtest runs.
 * GET /api/backtest/runs
 */
export async function listRuns(): Promise<RunListItem[]> {
  const res = await fetch("/api/backtest/runs");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.runs as RunListItem[];
}

/**
 * Get full details for a single run.
 * GET /api/backtest/runs?runId=xxx
 */
export async function getRunDetail(runId: string): Promise<RunDetailResponse> {
  const res = await fetch(
    `/api/backtest/runs?runId=${encodeURIComponent(runId)}`,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Delete a run and all its data.
 * DELETE /api/backtest/runs?runId=xxx
 */
export async function deleteRun(runId: string): Promise<void> {
  const res = await fetch(
    `/api/backtest/runs?runId=${encodeURIComponent(runId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}

// ── Live Paper Trading ──────────────────────────────────────────────────────

/** Live trade executed at real current prices. */
export interface LiveTradeAction {
  symbol: string;
  action: "buy" | "sell";
  shares: number;
  price: number;
  amountUsd: number;
  commission: number;
  tax: number | null;
  realizedPnl: number | null;
}

/** Market data for a symbol in live mode. */
export interface LiveMarketData {
  symbol: string;
  currentPrice: number;
  rsi14: number;
  sma7: number;
  sma14: number;
}

/** Aggregated trade statistics for live mode. */
export interface LiveTradeStats {
  totalTrades: number;
  totalBuys: number;
  totalSells: number;
  wins: number;
  losses: number;
  winRate: number;
  totalRealizedPnl: number;
  totalCommissions: number;
  totalTax: number;
  bestTradePnl: number;
  worstTradePnl: number;
}

/** Response from POST /api/backtest/live. */
export interface LiveStepResponse {
  date: string;
  cash: number;
  totalValue: number;
  startingCapital: number;
  pnlUsd: number;
  pnlPct: number;
  actions: LiveTradeAction[];
  reasoning: string | null;
  markets: LiveMarketData[];
  tradeStats: LiveTradeStats;
}

/** Live portfolio state from GET /api/backtest/live. */
export interface LivePortfolioState {
  portfolio: {
    cash: number;
    positions: Array<{ symbol: string; shares: number; avgPrice: number }>;
    startingCapital: number;
    updatedAt: string | null;
  };
  trades: Array<{
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
  }>;
  snapshots: Array<{
    id: number;
    date: string;
    cash: number;
    positions: unknown;
    totalValue: number;
  }>;
}

/**
 * Execute one live trading step.
 * POST /api/backtest/live
 */
export async function liveStep(model: string): Promise<LiveStepResponse> {
  const res = await fetch("/api/backtest/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Get current live portfolio state.
 * GET /api/backtest/live
 */
export async function getLiveState(): Promise<LivePortfolioState> {
  const res = await fetch("/api/backtest/live");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Reset live portfolio to a new starting capital.
 * DELETE /api/backtest/live?capital=1000
 */
export async function resetLive(capital: number): Promise<void> {
  const res = await fetch(`/api/backtest/live?capital=${capital}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}
