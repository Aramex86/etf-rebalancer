// src/entities/backtest/index.ts — public API

export type {
  SimulationParams,
  RunStatus,
  BacktestRunRecord,
  BacktestTradeRecord,
  BacktestSnapshotRecord,
  SnapshotPosition,
  AgentAction,
  AgentResponse,
  ValidatedAction,
  StepResult,
  PortfolioPosition,
  PortfolioState,
  MarketContext,
  AgentContext,
  BacktestSummary,
  StartRunRequest,
  StartRunResponse,
  StepResponse,
  FinishRunResponse,
  RunListItem,
  RunDetailResponse,
  PastRunSummary,
} from "./model/backtestTypes";

export {
  createRun,
  getRun,
  listRuns,
  updateRunProgress,
  finalizeRun,
  failRun,
  deleteRun,
  insertTrade,
  getTradesByRun,
  insertSnapshot,
  getSnapshotsByRun,
  getLatestSnapshotWeek,
  listCompletedRunSummaries,
} from "./model/backtestRepository";

export {
  sma,
  volatility,
  highOver,
  lowOver,
  rsi,
  computeMarketContext,
} from "./model/indicators";

export {
  buildSystemPrompt,
  buildUserPrompt,
  parseAgentResponse,
} from "./model/swingAgentPrompt";

export {
  runStep,
  calculateBuyHold,
  calculateSummary,
  calcCommission,
  DEFAULT_PARAMS,
  loadMarketData,
} from "./model/backtestEngine";

export type { RunStepParams, LoadedMarketData } from "./model/backtestEngine";

// ── Live Paper Trading ──────────────────────────────────────────────────────

export type {
  LivePortfolio,
  LiveTradeRecord,
  LiveSnapshotRecord,
} from "./model/liveTradingRepository";

export {
  getLivePortfolio,
  resetLivePortfolio,
  updateLivePortfolio,
  insertLiveTrade,
  upsertLiveSnapshot,
  listLiveTrades,
  listLiveSnapshots,
} from "./model/liveTradingRepository";
