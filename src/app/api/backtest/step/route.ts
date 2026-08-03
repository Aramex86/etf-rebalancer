// src/app/api/backtest/step/route.ts

import { NextResponse } from "next/server";
import { runMigrations } from "@/shared/lib/migrations";
import { getAllPriceHistory } from "@/entities/market-data/model/priceHistoryRepository";
import { WATCHLIST_SEED } from "@/entities/market-data/model/watchlistSeed";
import type { PricePoint } from "@/shared/types/marketData";
import {
  getRun,
  getTradesByRun,
  getSnapshotsByRun,
  insertTrade,
  insertSnapshot,
  updateRunProgress,
  listCompletedRunSummaries,
  runStep,
  type StepResponse,
  type PortfolioState,
  type SimulationParams,
} from "@/entities/backtest";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Load price histories for all active symbols (excluding those in params.excludedSymbols).
 */
async function loadHistories(
  params: SimulationParams,
): Promise<{ histories: Map<string, PricePoint[]>; activeSymbols: string[] }> {
  const histories = new Map<string, PricePoint[]>();
  const activeSymbols: string[] = [];

  for (const item of WATCHLIST_SEED) {
    if (params.excludedSymbols.includes(item.symbol)) continue;
    const history = await getAllPriceHistory(item.symbol);
    if (history.length < params.historyDays + params.stepDays) continue;
    histories.set(item.symbol, history);
    activeSymbols.push(item.symbol);
  }

  return { histories, activeSymbols };
}

/**
 * Compute step indices from active symbol histories.
 */
function computeStepIndices(
  histories: Map<string, PricePoint[]>,
  activeSymbols: string[],
  params: SimulationParams,
): number[] {
  const minHistoryLength = Math.min(
    ...activeSymbols.map((s) => histories.get(s)!.length),
  );
  const stepIndices: number[] = [];
  for (
    let i = params.historyDays;
    i + params.stepDays < minHistoryLength;
    i += params.stepDays
  ) {
    stepIndices.push(i);
  }
  return stepIndices;
}

/**
 * Reconstruct portfolio state from a previous snapshot.
 */
function portfolioFromSnapshot(snap: {
  cash: number;
  positions: Array<{ symbol: string; shares: number; avgPrice: number }>;
}): PortfolioState {
  return {
    cash: snap.cash,
    positions: snap.positions.map((p) => ({
      symbol: p.symbol,
      shares: p.shares,
      avgPrice: p.avgPrice,
    })),
  };
}

/**
 * Save executed trades to DB.
 */
async function saveTrades(
  validatedActions: Array<{
    status: string;
    trade?: {
      runId: string;
      week: number;
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
    };
  }>,
): Promise<void> {
  for (const va of validatedActions) {
    if (va.status === "executed" && va.trade) {
      const t = va.trade;
      await insertTrade({
        runId: t.runId,
        week: t.week,
        date: t.date,
        symbol: t.symbol,
        action: t.action,
        shares: t.shares,
        price: t.price,
        amountUsd: t.amountUsd,
        commission: t.commission,
        tax: t.tax,
        realizedPnl: t.realizedPnl,
        cashAfter: t.cashAfter,
      });
    }
  }
}

/**
 * POST /api/backtest/step?runId=xxx&week=12
 *
 * Executes a single simulation step (1 week).
 * The client calls this repeatedly for each week.
 *
 * Response: { runId, week, totalWeeks, status, cash, totalValue, actions, reasoning }
 */
export async function POST(request: Request) {
  try {
    await runMigrations();

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");
    const weekParam = searchParams.get("week");

    if (!runId || !weekParam) {
      return NextResponse.json(
        { error: "Missing runId or week parameter" },
        { status: 400 },
      );
    }

    const targetWeek = Number.parseInt(weekParam, 10);

    // Get the run.
    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    if (run.status === "done" || run.status === "failed") {
      return NextResponse.json(
        { error: `Run already ${run.status}` },
        { status: 400 },
      );
    }

    // Load market data.
    const { histories, activeSymbols } = await loadHistories(run.params);
    const stepIndices = computeStepIndices(
      histories,
      activeSymbols,
      run.params,
    );

    if (targetWeek < 1 || targetWeek > stepIndices.length) {
      return NextResponse.json(
        {
          error: `Invalid week ${targetWeek}, must be 1..${stepIndices.length}`,
        },
        { status: 400 },
      );
    }

    const stepIndex = targetWeek - 1;

    // Reconstruct portfolio state from latest snapshot (for resumption).
    const snapshots = await getSnapshotsByRun(runId);
    const trades = await getTradesByRun(runId);

    let portfolio: PortfolioState;

    if (targetWeek === 1) {
      // First step — start with cash only.
      portfolio = { cash: run.startValue, positions: [] };
    } else {
      const prevSnap = snapshots.find((s) => s.week === targetWeek - 1);
      if (!prevSnap) {
        return NextResponse.json(
          { error: `Cannot resume: no snapshot for week ${targetWeek - 1}` },
          { status: 400 },
        );
      }
      portfolio = portfolioFromSnapshot(prevSnap);
    }

    // Run the step.
    const pastRuns = await listCompletedRunSummaries(runId, 10);

    const result = await runStep({
      stepIndex,
      stepIndices,
      histories,
      activeSymbols,
      portfolio,
      recentTrades: trades,
      params: run.params,
      runId,
      model: run.model,
      pastRuns,
    });

    // Save trades + snapshot to DB.
    await saveTrades(result.validatedActions);

    await insertSnapshot({
      runId: result.snapshot.runId,
      week: result.snapshot.week,
      date: result.snapshot.date,
      cash: result.snapshot.cash,
      positions: result.snapshot.positions,
      totalValue: result.snapshot.totalValue,
    });
    await updateRunProgress(runId, targetWeek);

    const response: StepResponse = {
      runId,
      week: result.week,
      totalWeeks: stepIndices.length,
      status: targetWeek >= stepIndices.length ? "done" : "running",
      cash: result.cashAfter,
      totalValue: result.totalValue,
      actions: result.validatedActions,
      reasoning: result.agentResponse?.reasoning ?? null,
    };

    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Step failed: ${msg}` }, { status: 500 });
  }
}
