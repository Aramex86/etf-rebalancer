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
  DEFAULT_PARAMS,
  loadMarketData,
} from "./model/backtestEngine";

export type { RunStepParams, LoadedMarketData } from "./model/backtestEngine";
