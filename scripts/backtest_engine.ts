// scripts/backtest_engine.ts
//
// Backtest engine for the SMA-drift baseline model.
// Iterates over price_history, makes 7-day-ahead predictions at weekly
// intervals, and reports direction accuracy + average MAPE.
//
// Does NOT call the LLM — this establishes the lower bound that the
// LLM-based prediction must beat.
//
// Run:  npx tsx scripts/backtest_engine.ts

import { WATCHLIST_SEED } from "@/entities/market-data/model/watchlistSeed";
import { getAllPriceHistory } from "@/entities/market-data/model/priceHistoryRepository";
import { runMigrations } from "@/shared/lib/migrations";
import { smaDriftBaseline } from "@/entities/prediction/model/predictionBaselines";
import type { PricePoint } from "@/shared/types/marketData";
import type { Direction } from "@/entities/prediction/model/predictionRepository";

/** Number of trading days to predict ahead. */
const HORIZON_DAYS = 7;
/** Minimum history window before we start making predictions. */
const MIN_HISTORY = 30;
/** Step between backtest evaluation dates (trading days). */
const STEP_DAYS = 7;
/** ±1% threshold for direction classification (must match baselines). */
const FLAT_THRESHOLD_PCT = 1;

interface BacktestRow {
  symbol: string;
  predictions: number;
  directionCorrect: number;
  accuracy: number;
  avgMape: number;
}

/** Classify actual price movement into up/down/flat (±1%). */
function classifyActualDirection(
  currentPrice: number,
  actualPrice: number,
): Direction {
  const changePct = ((actualPrice - currentPrice) / currentPrice) * 100;
  if (changePct > FLAT_THRESHOLD_PCT) return "up";
  if (changePct < -FLAT_THRESHOLD_PCT) return "down";
  return "flat";
}

/** Run backtest for a single symbol. */
function backtestSymbol(
  symbol: string,
  history: PricePoint[],
): BacktestRow | null {
  if (history.length < MIN_HISTORY + HORIZON_DAYS) {
    console.log(
      `  ${symbol}: insufficient history (${history.length} points, need ${MIN_HISTORY + HORIZON_DAYS})`,
    );
    return null;
  }

  let predictions = 0;
  let directionCorrect = 0;
  let mapeSum = 0;

  // Start at index MIN_HISTORY, step by STEP_DAYS, stop HORIZON_DAYS before end.
  for (let i = MIN_HISTORY; i + HORIZON_DAYS < history.length; i += STEP_DAYS) {
    const window = history.slice(0, i + 1); // history up to and including day i
    const currentPrice = history[i].close;
    const actualPrice = history[i + HORIZON_DAYS].close;

    const { predictedPrice, direction: predictedDir } = smaDriftBaseline(
      window,
      HORIZON_DAYS,
    );

    const actualDir = classifyActualDirection(currentPrice, actualPrice);
    const isCorrect = predictedDir === actualDir;

    const errorPct = Math.abs(
      ((actualPrice - predictedPrice) / predictedPrice) * 100,
    );

    predictions++;
    if (isCorrect) directionCorrect++;
    mapeSum += errorPct;
  }

  if (predictions === 0) {
    console.log(`  ${symbol}: no valid prediction windows`);
    return null;
  }

  return {
    symbol,
    predictions,
    directionCorrect,
    accuracy: directionCorrect / predictions,
    avgMape: mapeSum / predictions,
  };
}

async function main(): Promise<void> {
  console.log("=== backtest_engine: SMA-drift baseline ===\n");
  console.log(`Horizon: ${HORIZON_DAYS} days | Step: ${STEP_DAYS} days\n`);

  await runMigrations();

  const rows: BacktestRow[] = [];

  for (const item of WATCHLIST_SEED) {
    console.log(`Processing ${item.symbol} ...`);
    const history = await getAllPriceHistory(item.symbol);
    const row = backtestSymbol(item.symbol, history);
    if (row) rows.push(row);
  }

  // Summary table
  console.log("\n=== Summary ===");
  console.log("Symbol  Predictions  DirectionCorrect  Accuracy  AvgMAPE");
  console.log("------  -----------  ----------------  --------  -------");
  for (const r of rows) {
    console.log(
      `${r.symbol.padEnd(6)}  ${String(r.predictions).padStart(11)}  ${String(r.directionCorrect).padStart(16)}  ${(r.accuracy * 100).toFixed(1).padStart(7)}%  ${r.avgMape.toFixed(2).padStart(6)}%`,
    );
  }

  // Overall
  const totalPredictions = rows.reduce((s, r) => s + r.predictions, 0);
  const totalCorrect = rows.reduce((s, r) => s + r.directionCorrect, 0);
  const overallAccuracy =
    totalPredictions > 0 ? totalCorrect / totalPredictions : 0;
  const overallMape =
    rows.length > 0 ? rows.reduce((s, r) => s + r.avgMape, 0) / rows.length : 0;

  console.log(
    `\nOverall: ${totalCorrect}/${totalPredictions} = ${(overallAccuracy * 100).toFixed(1)}% | Avg MAPE: ${overallMape.toFixed(2)}%`,
  );

  if (overallAccuracy < 0.55) {
    console.log(
      "\n⚠ Baseline accuracy < 55% — LLM must beat this to be useful for signals.",
    );
  } else {
    console.log(
      "\n✓ Baseline accuracy ≥ 55% — LLM should beat this for reliable signals.",
    );
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
