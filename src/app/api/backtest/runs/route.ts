// src/app/api/backtest/runs/route.ts

import { NextResponse } from "next/server";
import { runMigrations } from "@/shared/lib/migrations";
import {
  listRuns,
  getRun,
  deleteRun,
  getTradesByRun,
  getSnapshotsByRun,
  type RunListItem,
  type RunDetailResponse,
  type BacktestSummary,
} from "@/entities/backtest";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * GET /api/backtest/runs
 * Returns a list of all backtest runs (newest first).
 *
 * GET /api/backtest/runs?runId=xxx
 * Returns full details for a single run: run record, trades, snapshots.
 */
export async function GET(request: Request) {
  try {
    await runMigrations();

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (runId) {
      // Single run detail.
      const run = await getRun(runId);
      if (!run) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }

      const trades = await getTradesByRun(runId);
      const snapshots = await getSnapshotsByRun(runId);

      // Build summary if run is done.
      let summary: BacktestSummary | null = null;
      if (run.status === "done" && run.endValue !== null) {
        summary = {
          startValue: run.startValue,
          endValue: run.endValue,
          totalReturnPct: run.totalReturnPct ?? 0,
          buyHoldReturnPct: run.buyHoldReturnPct ?? 0,
          sharpeRatio: run.sharpeRatio ?? 0,
          maxDrawdownPct: run.maxDrawdownPct ?? 0,
          winRate: run.winRate ?? 0,
          totalTrades: run.totalTrades,
          profitableTrades: run.profitableTrades,
          totalCommission: run.totalCommission,
          totalTax: run.totalTax,
          vsBuyHoldDeltaPct:
            (run.totalReturnPct ?? 0) - (run.buyHoldReturnPct ?? 0),
        };
      }

      const response: RunDetailResponse = {
        run,
        summary,
        trades,
        snapshots,
      };

      return NextResponse.json(response);
    }

    // List all runs.
    const runs: RunListItem[] = await listRuns();
    return NextResponse.json({ runs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to fetch runs: ${msg}` },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/backtest/runs?runId=xxx
 * Deletes a run and all its trades and snapshots.
 */
export async function DELETE(request: Request) {
  try {
    await runMigrations();

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json(
        { error: "Missing runId query parameter" },
        { status: 400 },
      );
    }

    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    await deleteRun(runId);

    return NextResponse.json({ success: true, deletedRunId: runId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to delete run: ${msg}` },
      { status: 500 },
    );
  }
}
