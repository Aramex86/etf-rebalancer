// src/app/api/backtest/start/route.ts

import { NextResponse } from "next/server";
import { predictionConfig } from "@/shared/lib/predictionConfig";
import { runMigrations } from "@/shared/lib/migrations";
import {
  createRun,
  DEFAULT_PARAMS,
  loadMarketData,
  type SimulationParams,
  type StartRunRequest,
  type StartRunResponse,
} from "@/entities/backtest";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/backtest/start
 * Creates a new backtest run, loads market data, and returns the runId.
 *
 * Body: { model?: string, capital?: number }
 * Response: { runId, totalWeeks, excludedSymbols, params }
 */
export async function POST(request: Request) {
  try {
    await runMigrations();

    const body = (await request.json().catch(() => ({}))) as StartRunRequest;

    const model = body.model || predictionConfig.ollama.predictionModel;
    const capital = body.capital || DEFAULT_PARAMS.startingCapital;

    const params: SimulationParams = {
      ...DEFAULT_PARAMS,
      startingCapital: capital,
    };

    // Load market data and determine active/excluded symbols.
    const marketData = await loadMarketData(params);

    if (marketData.activeSymbols.length < 3) {
      return NextResponse.json(
        {
          error: `Недостаточно данных: только ${marketData.activeSymbols.length} ETF с историей (нужно минимум 3). Исключены: ${marketData.excludedSymbols.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Generate unique runId.
    const now = new Date();
    const runId = `${now.toISOString().slice(0, 16).replaceAll(":", "-")}_${model.split(":")[0]}_${capital}usd`;

    // Create run in DB.
    await createRun(runId, model, params, capital, marketData.totalSteps);

    const response: StartRunResponse = {
      runId,
      totalWeeks: marketData.totalSteps,
      excludedSymbols: marketData.excludedSymbols,
      params,
    };

    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to start backtest: ${msg}` },
      { status: 500 },
    );
  }
}
