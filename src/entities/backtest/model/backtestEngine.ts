// src/entities/backtest/model/backtestEngine.ts

import { callOllamaChat, type ChatMessage } from "@/shared/lib/ollama";
import { getAllPriceHistory } from "@/entities/market-data/model/priceHistoryRepository";
import { WATCHLIST_SEED } from "@/entities/market-data/model/watchlistSeed";
import type { PricePoint } from "@/shared/types/marketData";
import { computeMarketContext } from "./indicators";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseAgentResponse,
} from "./swingAgentPrompt";
import type {
  AgentContext,
  AgentResponse,
  AgentAction,
  BacktestSummary,
  BacktestTradeRecord,
  BacktestSnapshotRecord,
  PortfolioPosition,
  PortfolioState,
  SimulationParams,
  SnapshotPosition,
  StepResult,
  ValidatedAction,
  MarketContext,
} from "./backtestTypes";

// ---------------------------------------------------------------------------
// Default simulation parameters
// ---------------------------------------------------------------------------

/** Default parameters for a backtest run. */
export const DEFAULT_PARAMS: SimulationParams = {
  startingCapital: 1000,
  maxPositions: 3,
  maxPositionPct: 0.5,
  commissionMin: 1,
  spreadPct: 0.0005,
  taxPct: 0.12,
  stepDays: 5,
  historyDays: 30,
  minTradeUsd: 50,
  period: "3y",
  excludedSymbols: [],
};

// ---------------------------------------------------------------------------
// Commission calculation
// ---------------------------------------------------------------------------

/**
 * Calculate commission for a trade.
 * Commission = max($1 minimum, spreadPct × amountUsd).
 */
export function calcCommission(
  amountUsd: number,
  params: SimulationParams,
): number {
  const spreadCost = amountUsd * params.spreadPct;
  return Math.max(params.commissionMin, spreadCost);
}

// ---------------------------------------------------------------------------
// Price data loading & validation
// ---------------------------------------------------------------------------

/** Result of loading market data for all symbols. */
export interface LoadedMarketData {
  /** Map: symbol → full price history (ascending). */
  histories: Map<string, PricePoint[]>;
  /** Symbols with sufficient history for simulation. */
  activeSymbols: string[];
  /** Symbols excluded due to insufficient history. */
  excludedSymbols: string[];
  /** Total number of simulation steps. */
  totalSteps: number;
  /** Step indices (indices into the price arrays). */
  stepIndices: number[];
}

/**
 * Load price history for all watchlist ETFs and determine which have enough data.
 * @param params Simulation parameters.
 * @returns Loaded market data with active/excluded symbols + step indices.
 */
export async function loadMarketData(
  params: SimulationParams,
): Promise<LoadedMarketData> {
  const histories = new Map<string, PricePoint[]>();
  const activeSymbols: string[] = [];
  const excludedSymbols: string[] = [];

  // Minimum history needed: historyDays + stepDays (for indicators + first step).
  const minPoints = params.historyDays + params.stepDays;

  for (const item of WATCHLIST_SEED) {
    const history = await getAllPriceHistory(item.symbol);

    if (history.length < minPoints) {
      excludedSymbols.push(item.symbol);
      continue;
    }

    histories.set(item.symbol, history);
    activeSymbols.push(item.symbol);
  }

  // Compute step indices based on the shortest active history.
  const minHistoryLength = Math.min(
    ...activeSymbols.map((s) => histories.get(s)!.length),
  );

  // Steps: start at index historyDays, step by stepDays, stop stepDays before end
  // (so we have a "next week" price for execution).
  const stepIndices: number[] = [];
  for (
    let i = params.historyDays;
    i + params.stepDays < minHistoryLength;
    i += params.stepDays
  ) {
    stepIndices.push(i);
  }

  return {
    histories,
    activeSymbols,
    excludedSymbols,
    totalSteps: stepIndices.length,
    stepIndices,
  };
}

// ---------------------------------------------------------------------------
// Build agent context for a step
// ---------------------------------------------------------------------------

/**
 * Build the full agent context for a given simulation step.
 * @param stepIndex Index into stepIndices.
 * @param stepIndices Array of price array indices for each step.
 * @param histories Map of symbol → price history.
 * @param activeSymbols Symbols to include.
 * @param portfolio Current portfolio state.
 * @param recentTrades Recent trade records.
 * @param params Simulation params.
 * @returns AgentContext for the LLM.
 */
export function buildAgentContext(
  stepIndex: number,
  stepIndices: number[],
  histories: Map<string, PricePoint[]>,
  activeSymbols: string[],
  portfolio: PortfolioState,
  recentTrades: BacktestTradeRecord[],
  _params: SimulationParams,
): AgentContext {
  const priceIndex = stepIndices[stepIndex];
  const date = histories.get(activeSymbols[0])![priceIndex].date;

  // Compute market context for each active symbol.
  const markets: MarketContext[] = activeSymbols.map((symbol) => {
    const history = histories.get(symbol)!;
    // Slice history up to and including current step (no lookahead).
    const window = history.slice(0, priceIndex + 1);
    return computeMarketContext(symbol, window);
  });

  // Build portfolio positions with current market values.
  const positions = portfolio.positions.map((pos) => {
    const history = histories.get(pos.symbol);
    const currentPrice = history ? history[priceIndex].close : pos.avgPrice;
    const marketValue = pos.shares * currentPrice;
    const unrealizedPnl = (currentPrice - pos.avgPrice) * pos.shares;
    return {
      symbol: pos.symbol,
      shares: pos.shares,
      avgPrice: pos.avgPrice,
      marketValue,
      unrealizedPnl,
    };
  });

  const totalValue =
    portfolio.cash + positions.reduce((s, p) => s + p.marketValue, 0);

  // Format recent trades (last 4).
  const recent = recentTrades.slice(-4).map((t) => ({
    week: t.week,
    symbol: t.symbol,
    action: t.action,
    shares: t.shares,
    price: t.price,
    realizedPnl: t.realizedPnl,
  }));

  return {
    week: stepIndex + 1,
    totalWeeks: stepIndices.length,
    date,
    markets,
    portfolio: {
      cash: portfolio.cash,
      positions,
      totalValue,
    },
    recentTrades: recent,
  };
}

// ---------------------------------------------------------------------------
// Validate and execute actions
// ---------------------------------------------------------------------------

/**
 * Validate a buy action against portfolio constraints.
 * Returns a reason string if rejected, or null if valid.
 */
function validateBuy(
  action: AgentAction,
  portfolio: PortfolioState,
  params: SimulationParams,
): string | null {
  const amountUsd = action.amountUsd ?? 0;

  if (amountUsd < params.minTradeUsd) {
    return `amount $${amountUsd.toFixed(2)} below minimum $${params.minTradeUsd}`;
  }

  const maxAllowed = portfolio.cash * params.maxPositionPct;
  if (amountUsd > maxAllowed) {
    return `amount $${amountUsd.toFixed(2)} exceeds max ${params.maxPositionPct * 100}% of cash ($${maxAllowed.toFixed(2)})`;
  }

  const commission = calcCommission(amountUsd, params);
  if (amountUsd + commission > portfolio.cash) {
    return `insufficient cash ($${portfolio.cash.toFixed(2)}) for $${amountUsd.toFixed(2)} + commission`;
  }

  const hasPosition = portfolio.positions.some(
    (p) => p.symbol === action.symbol,
  );
  if (!hasPosition && portfolio.positions.length >= params.maxPositions) {
    return `max ${params.maxPositions} positions reached`;
  }

  return null;
}

/**
 * Validate a sell action against portfolio constraints.
 * Returns a reason string if rejected, or null if valid.
 */
function validateSell(
  action: AgentAction,
  portfolio: PortfolioState,
): string | null {
  const shares = action.shares ?? 0;

  if (shares <= 0) {
    return "invalid share count for sell";
  }

  const position = portfolio.positions.find((p) => p.symbol === action.symbol);
  if (!position) {
    return `no position to sell for ${action.symbol}`;
  }

  if (shares > position.shares) {
    return `trying to sell ${shares} shares, only ${position.shares} owned`;
  }

  return null;
}

/**
 * Validate a single agent action against portfolio constraints.
 * Returns a reason string if rejected, or null if valid.
 */
function validateAction(
  action: AgentAction,
  portfolio: PortfolioState,
  params: SimulationParams,
  _executionPrice: number,
): string | null {
  if (action.action === "hold") return null;
  if (action.action === "buy") return validateBuy(action, portfolio, params);
  if (action.action === "sell") return validateSell(action, portfolio);
  return "unknown action";
}

/**
 * Execute a buy: deduct cash, add/update position.
 * @returns Trade record + updated portfolio.
 */
function executeBuy(
  action: AgentAction,
  portfolio: PortfolioState,
  executionPrice: number,
  week: number,
  date: string,
  runId: string,
  params: SimulationParams,
): { trade: BacktestTradeRecord; portfolio: PortfolioState } {
  const amountUsd = action.amountUsd!;
  const commission = calcCommission(amountUsd, params);

  // Apply spread: buy at price + spread (slightly worse).
  const fillPrice = executionPrice * (1 + params.spreadPct);
  const shares = Math.floor(amountUsd / fillPrice);
  const actualAmount = shares * fillPrice;

  const cashAfter = portfolio.cash - actualAmount - commission;

  // Update or create position.
  const existing = portfolio.positions.find((p) => p.symbol === action.symbol);
  let positions: PortfolioPosition[];

  if (existing) {
    const totalShares = existing.shares + shares;
    const totalCost = existing.shares * existing.avgPrice + shares * fillPrice;
    const newAvgPrice = totalCost / totalShares;
    positions = portfolio.positions.map((p) =>
      p.symbol === action.symbol
        ? { symbol: p.symbol, shares: totalShares, avgPrice: newAvgPrice }
        : p,
    );
  } else {
    positions = [
      ...portfolio.positions,
      { symbol: action.symbol, shares, avgPrice: fillPrice },
    ];
  }

  const trade: BacktestTradeRecord = {
    id: 0, // DB assigns
    runId,
    week,
    date,
    symbol: action.symbol,
    action: "buy",
    shares,
    price: fillPrice,
    amountUsd: actualAmount,
    commission,
    tax: null,
    realizedPnl: null,
    cashAfter,
  };

  return {
    trade,
    portfolio: { cash: cashAfter, positions },
  };
}

/**
 * Execute a sell: add cash, remove/reduce position, calculate tax on profit.
 * @returns Trade record + updated portfolio.
 */
function executeSell(
  action: AgentAction,
  portfolio: PortfolioState,
  executionPrice: number,
  week: number,
  date: string,
  runId: string,
  params: SimulationParams,
): { trade: BacktestTradeRecord; portfolio: PortfolioState } {
  const shares = action.shares!;
  const position = portfolio.positions.find((p) => p.symbol === action.symbol)!;

  // Apply spread: sell at price - spread (slightly worse).
  const fillPrice = executionPrice * (1 - params.spreadPct);
  const amountUsd = shares * fillPrice;
  const commission = calcCommission(amountUsd, params);

  // Realized P&L = proceeds - cost basis.
  const costBasis = shares * position.avgPrice;
  const proceeds = amountUsd;
  const grossPnl = proceeds - costBasis;

  // Tax only on positive P&L.
  const tax = grossPnl > 0 ? grossPnl * params.taxPct : 0;
  const netPnl = grossPnl - tax;

  const cashAfter = portfolio.cash + proceeds - commission - tax;

  // Update positions.
  const remainingShares = position.shares - shares;
  let positions: PortfolioPosition[];
  if (remainingShares > 0) {
    positions = portfolio.positions.map((p) =>
      p.symbol === action.symbol
        ? { symbol: p.symbol, shares: remainingShares, avgPrice: p.avgPrice }
        : p,
    );
  } else {
    positions = portfolio.positions.filter((p) => p.symbol !== action.symbol);
  }

  const trade: BacktestTradeRecord = {
    id: 0,
    runId,
    week,
    date,
    symbol: action.symbol,
    action: "sell",
    shares,
    price: fillPrice,
    amountUsd,
    commission,
    tax,
    realizedPnl: netPnl,
    cashAfter,
  };

  return {
    trade,
    portfolio: { cash: cashAfter, positions },
  };
}

// ---------------------------------------------------------------------------
// Run a single simulation step
// ---------------------------------------------------------------------------

/** Bundled parameters for runStep (avoids exceeding max parameter count). */
export interface RunStepParams {
  stepIndex: number;
  stepIndices: number[];
  histories: Map<string, PricePoint[]>;
  activeSymbols: string[];
  portfolio: PortfolioState;
  recentTrades: BacktestTradeRecord[];
  params: SimulationParams;
  runId: string;
  model: string;
}

/**
 * Execute a single validated action and return updated portfolio + trade record.
 */
function executeAction(
  action: AgentAction,
  portfolio: PortfolioState,
  executionPrice: number,
  week: number,
  date: string,
  runId: string,
  params: SimulationParams,
): { trade: BacktestTradeRecord; portfolio: PortfolioState } {
  if (action.action === "buy") {
    return executeBuy(
      action,
      portfolio,
      executionPrice,
      week,
      date,
      runId,
      params,
    );
  }
  return executeSell(
    action,
    portfolio,
    executionPrice,
    week,
    date,
    runId,
    params,
  );
}

/**
 * Process all actions from the agent response.
 * Returns validated actions + updated portfolio.
 */
function processActions(
  agentResponse: AgentResponse | null,
  p: RunStepParams,
  executionPriceIndex: number,
): { validatedActions: ValidatedAction[]; portfolio: PortfolioState } {
  const validatedActions: ValidatedAction[] = [];
  let currentPortfolio = {
    ...p.portfolio,
    positions: [...p.portfolio.positions],
  };

  if (!agentResponse) {
    return { validatedActions, portfolio: currentPortfolio };
  }

  for (const action of agentResponse.actions) {
    if (action.action === "hold") {
      validatedActions.push({ action, status: "executed" });
      continue;
    }

    const history = p.histories.get(action.symbol);
    if (!history || executionPriceIndex >= history.length) {
      validatedActions.push({
        action,
        status: "rejected",
        reason: "no execution price available",
      });
      continue;
    }

    const executionPrice = history[executionPriceIndex].close;
    const rejectionReason = validateAction(
      action,
      currentPortfolio,
      p.params,
      executionPrice,
    );
    if (rejectionReason) {
      validatedActions.push({
        action,
        status: "rejected",
        reason: rejectionReason,
      });
      continue;
    }

    const week = p.stepIndex + 1;
    const date = p.histories.get(p.activeSymbols[0])![
      p.stepIndices[p.stepIndex]
    ].date;
    const result = executeAction(
      action,
      currentPortfolio,
      executionPrice,
      week,
      date,
      p.runId,
      p.params,
    );
    validatedActions.push({ action, status: "executed", trade: result.trade });
    currentPortfolio = result.portfolio;
  }

  return { validatedActions, portfolio: currentPortfolio };
}

/**
 * Run a single simulation step (1 week).
 *
 * 1. Build agent context from market data + portfolio.
 * 2. Call LLM for actions.
 * 3. Validate + execute each action.
 * 4. Save snapshot.
 *
 * @param p  Bundled run step parameters.
 * @returns StepResult with actions, snapshot, updated portfolio.
 */
export async function runStep(p: RunStepParams): Promise<StepResult> {
  // Build context for the LLM (uses data up to current step, no lookahead).
  const context = buildAgentContext(
    p.stepIndex,
    p.stepIndices,
    p.histories,
    p.activeSymbols,
    p.portfolio,
    p.recentTrades,
    p.params,
  );

  // Call LLM.
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(context) },
  ];

  let agentResponse: AgentResponse | null = null;
  try {
    const rawResponse = await callOllamaChat(p.model, messages);
    agentResponse = parseAgentResponse(rawResponse);
  } catch {
    // LLM failed — agent does nothing this step.
    agentResponse = null;
  }

  // Execution price = next step's closing price (no lookahead bias).
  const executionPriceIndex = p.stepIndices[p.stepIndex] + p.params.stepDays;

  // Process all actions (validation + execution).
  const { validatedActions, portfolio: currentPortfolio } = processActions(
    agentResponse,
    p,
    executionPriceIndex,
  );

  // Build snapshot at execution price (next step's price).
  const snapshotDate = p.activeSymbols[0]
    ? (p.histories.get(p.activeSymbols[0])![executionPriceIndex]?.date ??
      context.date)
    : context.date;

  const snapshotPositions: SnapshotPosition[] = currentPortfolio.positions.map(
    (pos) => {
      const history = p.histories.get(pos.symbol);
      const price = history ? history[executionPriceIndex].close : pos.avgPrice;
      return {
        symbol: pos.symbol,
        shares: pos.shares,
        avgPrice: pos.avgPrice,
        marketValue: pos.shares * price,
        unrealizedPnl: (price - pos.avgPrice) * pos.shares,
      };
    },
  );

  const totalValue =
    currentPortfolio.cash +
    snapshotPositions.reduce((s, p) => s + p.marketValue, 0);

  const snapshot: BacktestSnapshotRecord = {
    id: 0,
    runId: p.runId,
    week: context.week,
    date: snapshotDate,
    cash: currentPortfolio.cash,
    positions: snapshotPositions,
    totalValue,
  };

  return {
    week: context.week,
    date: snapshotDate,
    agentResponse,
    validatedActions,
    snapshot,
    cashAfter: currentPortfolio.cash,
    totalValue,
  };
}

// ---------------------------------------------------------------------------
// Buy & Hold baseline
// ---------------------------------------------------------------------------

/**
 * Calculate Buy & Hold baseline: split capital equally among active symbols
 * at the first step, hold until the end.
 *
 * @param histories Map of symbol → price history.
 * @param activeSymbols Symbols in simulation.
 * @param stepIndices Step indices.
 * @param startingCapital Starting capital.
 * @returns Final portfolio value.
 */
export function calculateBuyHold(
  histories: Map<string, PricePoint[]>,
  activeSymbols: string[],
  stepIndices: number[],
  startingCapital: number,
): { startValue: number; endValue: number; returnPct: number } {
  if (activeSymbols.length === 0 || stepIndices.length === 0) {
    return {
      startValue: startingCapital,
      endValue: startingCapital,
      returnPct: 0,
    };
  }

  const firstPriceIndex = stepIndices[0];
  const lastPriceIndex = stepIndices.at(-1)! + 5; // execution price of last step

  const allocationPerSymbol = startingCapital / activeSymbols.length;
  let totalEndValue = 0;
  let totalInvested = 0;

  for (const symbol of activeSymbols) {
    const history = histories.get(symbol)!;
    const startPrice = history[firstPriceIndex].close;
    const endPrice =
      history[Math.min(lastPriceIndex, history.length - 1)].close;

    const shares = Math.floor(allocationPerSymbol / startPrice);
    totalInvested += shares * startPrice;
    totalEndValue += shares * endPrice;
  }

  // Cash remainder (from rounding down).
  const cashRemainder = startingCapital - totalInvested;
  const endValue = totalEndValue + cashRemainder;
  const returnPct = ((endValue - startingCapital) / startingCapital) * 100;

  return {
    startValue: startingCapital,
    endValue,
    returnPct,
  };
}

// ---------------------------------------------------------------------------
// Summary metrics
// ---------------------------------------------------------------------------

/**
 * Calculate summary metrics from trades + snapshots.
 * @param trades All trades in the run.
 * @param snapshots All snapshots in the run.
 * @param startingCapital Starting capital.
 * @param buyHoldReturnPct Buy & Hold return percentage.
 * @param params Simulation params.
 * @returns BacktestSummary.
 */
export function calculateSummary(
  trades: BacktestTradeRecord[],
  snapshots: BacktestSnapshotRecord[],
  startingCapital: number,
  buyHoldReturnPct: number,
  _params: SimulationParams,
): BacktestSummary {
  const endValue =
    snapshots.length > 0 ? snapshots.at(-1)!.totalValue : startingCapital;
  const totalReturnPct = ((endValue - startingCapital) / startingCapital) * 100;

  // Win rate from sell trades.
  const sellTrades = trades.filter((t) => t.action === "sell");
  const profitableTrades = sellTrades.filter(
    (t) => (t.realizedPnl ?? 0) > 0,
  ).length;
  const totalTrades = trades.length;
  const winRate =
    sellTrades.length > 0 ? profitableTrades / sellTrades.length : 0;

  // Total commission + tax.
  const totalCommission = trades.reduce((s, t) => s + t.commission, 0);
  const totalTax = trades.reduce((s, t) => s + (t.tax ?? 0), 0);

  // Sharpe ratio from weekly returns (rf = 0).
  const weeklyReturns: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1].totalValue;
    const curr = snapshots[i].totalValue;
    if (prev > 0) {
      weeklyReturns.push((curr - prev) / prev);
    }
  }

  let sharpeRatio = 0;
  if (weeklyReturns.length > 1) {
    const meanReturn =
      weeklyReturns.reduce((s, r) => s + r, 0) / weeklyReturns.length;
    const variance =
      weeklyReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) /
      weeklyReturns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) {
      // Annualise: √(52 weeks) — but our step is 5 trading days ≈ 1 week.
      sharpeRatio = (meanReturn / stdDev) * Math.sqrt(52);
    }
  }

  // Max drawdown from snapshots.
  let maxDrawdownPct = 0;
  let peak = snapshots.length > 0 ? snapshots[0].totalValue : startingCapital;
  for (const snap of snapshots) {
    if (snap.totalValue > peak) peak = snap.totalValue;
    const drawdown = ((peak - snap.totalValue) / peak) * 100;
    if (drawdown > maxDrawdownPct) maxDrawdownPct = drawdown;
  }

  return {
    startValue: startingCapital,
    endValue,
    totalReturnPct,
    buyHoldReturnPct,
    sharpeRatio,
    maxDrawdownPct,
    winRate,
    totalTrades,
    profitableTrades,
    totalCommission,
    totalTax,
    vsBuyHoldDeltaPct: totalReturnPct - buyHoldReturnPct,
  };
}
