// src/app/api/backtest/finish/route.ts

import { NextResponse } from "next/server";
import { runMigrations } from "@/shared/lib/migrations";
import { getAllPriceHistory } from "@/entities/market-data/model/priceHistoryRepository";
import { WATCHLIST_SEED } from "@/entities/market-data/model/watchlistSeed";
import type { PricePoint } from "@/shared/types/marketData";
import {
  getRun,
  getTradesByRun,
  getSnapshotsByRun,
  finalizeRun,
  calculateBuyHold,
  calculateSummary,
  type FinishRunResponse,
} from "@/entities/backtest";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/backtest/finish?runId=xxx
 *
 * Calculates final metrics, Buy & Hold baseline, and marks the run as done.
 *
 * Response: { runId, status, summary }
 */
export async function POST(request: Request) {
  try {
    await runMigrations();

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json(
        { error: "Missing runId parameter" },
        { status: 400 },
      );
    }

    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Get all trades + snapshots.
    const trades = await getTradesByRun(runId);
    const snapshots = await getSnapshotsByRun(runId);

    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: "No snapshots found — run may not have started" },
        { status: 400 },
      );
    }

    // Calculate Buy & Hold baseline.
    const histories = new Map<string, PricePoint[]>();
    const activeSymbols: string[] = [];

    for (const item of WATCHLIST_SEED) {
      if (run.params.excludedSymbols.includes(item.symbol)) continue;
      const history = await getAllPriceHistory(item.symbol);
      if (history.length < run.params.historyDays + run.params.stepDays)
        continue;
      histories.set(item.symbol, history);
      activeSymbols.push(item.symbol);
    }

    const minHistoryLength = Math.min(
      ...activeSymbols.map((s) => histories.get(s)!.length),
    );
    const stepIndices: number[] = [];
    for (
      let i = run.params.historyDays;
      i + run.params.stepDays < minHistoryLength;
      i += run.params.stepDays
    ) {
      stepIndices.push(i);
    }

    const buyHold = calculateBuyHold(
      histories,
      activeSymbols,
      stepIndices,
      run.startValue,
    );

    // Calculate summary metrics.
    const summary = calculateSummary(
      trades,
      snapshots,
      run.startValue,
      buyHold.returnPct,
      run.params,
    );

    // Finalize run in DB.
    await finalizeRun(runId, summary);

    const response: FinishRunResponse = {
      runId,
      status: "done",
      summary,
    };

    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Finish failed: ${msg}` },
      { status: 500 },
    );
  }
}
