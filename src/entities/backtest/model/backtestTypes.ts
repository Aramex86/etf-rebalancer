// src/entities/backtest/model/backtestTypes.ts

// PricePoint is re-exported at the bottom of this file.

// ---------------------------------------------------------------------------
// Simulation parameters
// ---------------------------------------------------------------------------

/** Parameters for a single backtest run. Stored as JSONB in backtest_runs.params. */
export interface SimulationParams {
  /** Starting capital in USD. */
  startingCapital: number;
  /** Max concurrent positions. */
  maxPositions: number;
  /** Max fraction of cash that can go into one position (0-1). */
  maxPositionPct: number;
  /** Minimum commission per trade in USD. */
  commissionMin: number;
  /** Spread as a fraction of price (e.g. 0.0005 = 0.05%). */
  spreadPct: number;
  /** Capital gains tax on profit (0.12 = 12%). */
  taxPct: number;
  /** Step size in trading days (5 = 1 week). */
  stepDays: number;
  /** History window in days for indicators. */
  historyDays: number;
  /** Minimum trade amount in USD. */
  minTradeUsd: number;
  /** Period string for Yahoo Finance ("3y", "1y", ...). */
  period: string;
  /** ETF symbols excluded from simulation (insufficient history). */
  excludedSymbols: string[];
}

// ---------------------------------------------------------------------------
// Run record (maps to backtest_runs table)
// ---------------------------------------------------------------------------

export type RunStatus = "running" | "paused" | "done" | "failed";

export interface BacktestRunRecord {
  id: number;
  runId: string;
  model: string;
  status: RunStatus;
  params: SimulationParams;
  startValue: number;
  endValue: number | null;
  totalReturnPct: number | null;
  buyHoldReturnPct: number | null;
  sharpeRatio: number | null;
  maxDrawdownPct: number | null;
  winRate: number | null;
  totalTrades: number;
  profitableTrades: number;
  totalCommission: number;
  totalTax: number;
  currentWeek: number;
  totalWeeks: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Trade record (maps to backtest_trades table)
// ---------------------------------------------------------------------------

export type TradeAction = "buy" | "sell";

export interface BacktestTradeRecord {
  id: number;
  runId: string;
  week: number;
  date: string;
  symbol: string;
  action: TradeAction;
  shares: number;
  price: number;
  amountUsd: number;
  commission: number;
  tax: number | null;
  realizedPnl: number | null;
  cashAfter: number;
}

// ---------------------------------------------------------------------------
// Snapshot record (maps to backtest_snapshots table)
// ---------------------------------------------------------------------------

/** A single position in a portfolio snapshot. */
export interface SnapshotPosition {
  symbol: string;
  shares: number;
  avgPrice: number;
  marketValue: number;
  unrealizedPnl: number;
}

export interface BacktestSnapshotRecord {
  id: number;
  runId: string;
  week: number;
  date: string;
  cash: number;
  positions: SnapshotPosition[];
  totalValue: number;
}

// ---------------------------------------------------------------------------
// LLM agent types
// ---------------------------------------------------------------------------

/** A single action proposed by the LLM agent. */
export interface AgentAction {
  symbol: string;
  action: "buy" | "sell" | "hold";
  /** For buy: amount in USD to invest. */
  amountUsd?: number;
  /** For sell: number of shares to sell. */
  shares?: number;
}

/** Raw LLM response — parsed JSON from the trading agent. */
export interface AgentResponse {
  actions: AgentAction[];
  reasoning: string;
}

/** Action after validation by the engine. */
export interface ValidatedAction {
  action: AgentAction;
  status: "executed" | "rejected";
  reason?: string;
  /** Filled trade record if executed. */
  trade?: BacktestTradeRecord;
}

/** Result of a single simulation step (1 week). */
export interface StepResult {
  week: number;
  date: string;
  agentResponse: AgentResponse | null;
  validatedActions: ValidatedAction[];
  snapshot: BacktestSnapshotRecord;
  cashAfter: number;
  totalValue: number;
}

// ---------------------------------------------------------------------------
// Portfolio state (in-memory during simulation)
// ---------------------------------------------------------------------------

/** A position held by the simulation portfolio. */
export interface PortfolioPosition {
  symbol: string;
  shares: number;
  avgPrice: number;
}

/** In-memory portfolio state passed between simulation steps. */
export interface PortfolioState {
  cash: number;
  positions: PortfolioPosition[];
}

// ---------------------------------------------------------------------------
// Market data per ETF at a given step
// ---------------------------------------------------------------------------

/** Market context for a single ETF at a point in time. */
export interface MarketContext {
  symbol: string;
  currentPrice: number;
  sma7: number;
  sma14: number;
  rsi14: number;
  volatility: number;
  high30: number;
  low30: number;
}

/** Full context passed to the LLM agent at each step. */
export interface AgentContext {
  week: number;
  totalWeeks: number;
  date: string;
  markets: MarketContext[];
  portfolio: {
    cash: number;
    positions: Array<{
      symbol: string;
      shares: number;
      avgPrice: number;
      marketValue: number;
      unrealizedPnl: number;
    }>;
    totalValue: number;
    /** Starting capital for P&L calculation. */
    startingCapital: number;
    /** Absolute profit/loss: totalValue − startingCapital. */
    pnlUsd: number;
    /** Percentage return: (totalValue − startingCapital) / startingCapital × 100. */
    pnlPct: number;
  };
  recentTrades: Array<{
    week: number;
    symbol: string;
    action: TradeAction;
    shares: number;
    price: number;
    realizedPnl: number | null;
  }>;
  /** Summaries of past completed runs for feedback loop. */
  pastRuns: PastRunSummary[];
}

/** Summary of a past completed run — used for feedback loop. */
export interface PastRunSummary {
  runId: string;
  model: string;
  totalReturnPct: number;
  vsBuyHoldDeltaPct: number;
  winRate: number;
  totalTrades: number;
  maxDrawdownPct: number;
}

// ---------------------------------------------------------------------------
// Summary metrics
// ---------------------------------------------------------------------------

export interface BacktestSummary {
  startValue: number;
  endValue: number;
  totalReturnPct: number;
  buyHoldReturnPct: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  totalCommission: number;
  totalTax: number;
  vsBuyHoldDeltaPct: number;
}

// ---------------------------------------------------------------------------
// API request/response types
// ---------------------------------------------------------------------------

/** POST /api/backtest/start request body. */
export interface StartRunRequest {
  model?: string;
  capital?: number;
}

/** POST /api/backtest/start response. */
export interface StartRunResponse {
  runId: string;
  totalWeeks: number;
  excludedSymbols: string[];
  params: SimulationParams;
}

/** POST /api/backtest/step response. */
export interface StepResponse {
  runId: string;
  week: number;
  totalWeeks: number;
  status: RunStatus;
  cash: number;
  totalValue: number;
  actions: ValidatedAction[];
  reasoning: string | null;
}

/** POST /api/backtest/finish response. */
export interface FinishRunResponse {
  runId: string;
  status: RunStatus;
  summary: BacktestSummary;
}

/** GET /api/backtest/runs list item. */
export interface RunListItem {
  runId: string;
  model: string;
  status: RunStatus;
  totalReturnPct: number | null;
  buyHoldReturnPct: number | null;
  vsBuyHoldDeltaPct: number | null;
  totalTrades: number;
  createdAt: string;
}

/** GET /api/backtest/runs/:runId detail response. */
export interface RunDetailResponse {
  run: BacktestRunRecord;
  summary: BacktestSummary | null;
  trades: BacktestTradeRecord[];
  snapshots: BacktestSnapshotRecord[];
}

export type { PricePoint } from "@/shared/types/marketData";
