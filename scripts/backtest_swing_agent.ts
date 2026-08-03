// scripts/backtest_swing_agent.ts
//
// CLI script to run a full swing trading backtest simulation locally.
// Loads market data, runs all steps sequentially, calculates final metrics.
//
// Run:  npx tsx scripts/backtest_swing_agent.ts [--model=qwen3-coder:480b] [--capital=1000]
//
// The simulation calls the LLM (Ollama Cloud) for each weekly step.
// A full 3-year run with 5-day steps ≈ 151 LLM calls.

import { runMigrations } from "@/shared/lib/migrations";
import { predictionConfig } from "@/shared/lib/predictionConfig";
import {
  createRun,
  getTradesByRun,
  getSnapshotsByRun,
  insertTrade,
  insertSnapshot,
  updateRunProgress,
  finalizeRun,
  failRun,
  loadMarketData,
  runStep,
  calculateBuyHold,
  calculateSummary,
  DEFAULT_PARAMS,
  type SimulationParams,
  type PortfolioState,
  type ValidatedAction,
} from "@/entities/backtest";

function parseArgs(): { model: string; capital: number } {
  const args = process.argv.slice(2);
  let model = predictionConfig.ollama.predictionModel;
  let capital = DEFAULT_PARAMS.startingCapital;

  for (const arg of args) {
    if (arg.startsWith("--model=")) {
      model = arg.slice("--model=".length);
    } else if (arg.startsWith("--capital=")) {
      capital = Number.parseFloat(arg.slice("--capital=".length)) || capital;
    }
  }

  return { model, capital };
}

/**
 * Reconstruct portfolio state for a given week from DB snapshots.
 */
async function reconstructPortfolio(
  runId: string,
  week: number,
  capital: number,
): Promise<{
  portfolio: PortfolioState;
  trades: ReturnType<typeof getTradesByRun> extends Promise<infer T>
    ? T
    : never;
}> {
  const snapshots = await getSnapshotsByRun(runId);
  const trades = await getTradesByRun(runId);

  if (week === 1) {
    return { portfolio: { cash: capital, positions: [] }, trades };
  }

  const prevSnap = snapshots.find((s) => s.week === week - 1);
  if (!prevSnap) {
    throw new Error(`No snapshot for week ${week - 1}`);
  }

  return {
    portfolio: {
      cash: prevSnap.cash,
      positions: prevSnap.positions.map((p) => ({
        symbol: p.symbol,
        shares: p.shares,
        avgPrice: p.avgPrice,
      })),
    },
    trades,
  };
}

/**
 * Save validated trades from a step result to the database.
 */
async function saveStepTrades(
  validatedActions: ValidatedAction[],
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
 * Run the main simulation loop for all weeks.
 */
async function runSimulationLoop(
  runId: string,
  marketData: Awaited<ReturnType<typeof loadMarketData>>,
  params: SimulationParams,
  model: string,
  capital: number,
): Promise<void> {
  const { histories, activeSymbols, stepIndices } = marketData;

  for (let week = 1; week <= stepIndices.length; week++) {
    const stepIndex = week - 1;
    const { portfolio, trades } = await reconstructPortfolio(
      runId,
      week,
      capital,
    );

    process.stdout.write(`Week ${week}/${stepIndices.length} ... `);

    const result = await runStep({
      stepIndex,
      stepIndices,
      histories,
      activeSymbols,
      portfolio,
      recentTrades: trades,
      params,
      runId,
      model,
      pastRuns: [],
    });

    await saveStepTrades(result.validatedActions);

    await insertSnapshot({
      runId: result.snapshot.runId,
      week: result.snapshot.week,
      date: result.snapshot.date,
      cash: result.snapshot.cash,
      positions: result.snapshot.positions,
      totalValue: result.snapshot.totalValue,
    });

    await updateRunProgress(runId, week);

    const execCount = result.validatedActions.filter(
      (a) => a.status === "executed" && a.action.action !== "hold",
    ).length;
    console.log(`value=$${result.totalValue.toFixed(2)}  trades=${execCount}`);
  }
}

/**
 * Print final results summary.
 */
function printResults(
  summary: Awaited<ReturnType<typeof calculateSummary>>,
  runId: string,
): void {
  console.log();
  console.log("=== Results ===");
  console.log(`Start value:      $${summary.startValue.toFixed(2)}`);
  console.log(`End value:        $${summary.endValue.toFixed(2)}`);
  console.log(
    `Total return:     ${summary.totalReturnPct >= 0 ? "+" : ""}${summary.totalReturnPct.toFixed(2)}%`,
  );
  console.log(
    `Buy & Hold:       ${summary.buyHoldReturnPct >= 0 ? "+" : ""}${summary.buyHoldReturnPct.toFixed(2)}%`,
  );
  console.log(
    `vs B&H:           ${summary.vsBuyHoldDeltaPct >= 0 ? "+" : ""}${summary.vsBuyHoldDeltaPct.toFixed(2)}%`,
  );
  console.log(`Sharpe ratio:     ${summary.sharpeRatio.toFixed(2)}`);
  console.log(`Max drawdown:     -${summary.maxDrawdownPct.toFixed(2)}%`);
  console.log(
    `Win rate:         ${(summary.winRate * 100).toFixed(0)}% (${summary.profitableTrades}/${summary.totalTrades} trades)`,
  );
  console.log(`Total commission: $${summary.totalCommission.toFixed(2)}`);
  console.log(`Total tax:        $${summary.totalTax.toFixed(2)}`);
  console.log();
  console.log(`Run ID: ${runId}`);
}

async function main(): Promise<void> {
  const { model, capital } = parseArgs();

  console.log("=== Swing Trading Backtest CLI ===");
  console.log(`Model: ${model}`);
  console.log(`Capital: $${capital}`);
  console.log();

  await runMigrations();

  const params: SimulationParams = {
    ...DEFAULT_PARAMS,
    startingCapital: capital,
  };

  // Load market data.
  console.log("Loading market data…");
  const marketData = await loadMarketData(params);

  if (marketData.activeSymbols.length < 3) {
    console.error(
      `ERROR: Only ${marketData.activeSymbols.length} active symbols (need ≥3).`,
    );
    console.error(`Excluded: ${marketData.excludedSymbols.join(", ")}`);
    process.exit(1);
  }

  console.log(`Active symbols: ${marketData.activeSymbols.join(", ")}`);
  console.log(`Excluded: ${marketData.excludedSymbols.join(", ") || "none"}`);
  console.log(`Total steps: ${marketData.totalSteps}`);
  console.log();

  // Create run.
  const now = new Date();
  const runId = `${now.toISOString().slice(0, 16).replaceAll(":", "-")}_${model.split(":")[0]}_${capital}usd`;

  await createRun(runId, model, params, capital, marketData.totalSteps);
  console.log(`Run ID: ${runId}`);
  console.log();

  const { histories, activeSymbols, stepIndices } = marketData;

  try {
    await runSimulationLoop(runId, marketData, params, model, capital);

    // Finish — calculate metrics.
    console.log();
    console.log("Calculating final metrics…");

    const allTrades = await getTradesByRun(runId);
    const allSnapshots = await getSnapshotsByRun(runId);

    const buyHold = calculateBuyHold(
      histories,
      activeSymbols,
      stepIndices,
      capital,
    );

    const summary = calculateSummary(
      allTrades,
      allSnapshots,
      capital,
      buyHold.returnPct,
      params,
    );

    await finalizeRun(runId, summary);
    printResults(summary, runId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nSimulation failed: ${msg}`);
    await failRun(runId, msg);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
