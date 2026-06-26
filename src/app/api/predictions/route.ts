// src/app/api/predictions/route.ts

import { NextResponse } from "next/server";
import { RuntimeContext } from "@mastra/core/runtime-context";
import {
  getActiveWatchlist,
  getWatchlistBySymbol,
  fetchPriceHistory,
  savePriceBatch,
  getPriceHistory,
  getLatestPriceDate,
  type WatchlistItem,
} from "@/entities/market-data";
import {
  savePrediction,
  getLatestPredictions,
  getAccuracyBySymbol,
  smaDriftBaseline,
  predictionEngineTool,
  predictionTaxTool,
  predictionSignalTool,
  findBestAlternative,
  type PredictionSaveInput,
  type PredictionRecord,
} from "@/entities/prediction";
import { predictionConfig } from "@/shared/lib/predictionConfig";
import type { PricePoint } from "@/shared/types/marketData";

// Force Node.js runtime (required for `pg` driver) and extend the
// Vercel function timeout to 60s — the maximum on Hobby plan.
// Parallel LLM calls should complete well within this window.
export const runtime = "nodejs";
export const maxDuration = 60;

/** Prediction horizon in days (from config). */
const HORIZON_DAYS = predictionConfig.prediction.horizonDays;
/** History window for indicators (from config). */
const HISTORY_DAYS = predictionConfig.prediction.historyDays;

/**
 * Compute technical indicators from price history.
 */
function computeIndicators(history: PricePoint[]) {
  const closes = history.map((p) => p.close);

  const sma7 =
    closes.length >= 7
      ? closes.slice(-7).reduce((s, c) => s + c, 0) / 7
      : closes.reduce((s, c) => s + c, 0) / closes.length;

  const sma14 =
    closes.length >= 14
      ? closes.slice(-14).reduce((s, c) => s + c, 0) / 14
      : closes.reduce((s, c) => s + c, 0) / closes.length;

  // Daily returns → annualised volatility.
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const meanReturn = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  const variance =
    returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) /
    (returns.length || 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(252);

  const high30 = Math.max(...closes);
  const low30 = Math.min(...closes);

  return { sma7, sma14, volatility, high30, low30 };
}

/** Target date = today + HORIZON_DAYS (ISO YYYY-MM-DD). */
function getTargetDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + HORIZON_DAYS);
  return d.toISOString().slice(0, 10);
}

/** Run the full prediction pipeline for a single ticker. */
async function predictTicker(
  item: WatchlistItem,
): Promise<PredictionSaveInput | null> {
  try {
    // a. Fetch history: cache-first (DB), fall back to Yahoo Finance.
    //    Re-fetch from Yahoo if cache is stale (latest date ≠ today).
    let prices = await getPriceHistory(item.symbol, HISTORY_DAYS);
    const today = new Date().toISOString().slice(0, 10);
    const latestCached = await getLatestPriceDate(item.symbol);
    const cacheStale = latestCached !== today;

    if (prices.length < 14 || cacheStale) {
      // Cache miss, insufficient, or stale — try Yahoo Finance.
      try {
        const yahooPrices = await fetchPriceHistory(
          item.yahooSymbol,
          "30d",
          "1d",
        );
        if (yahooPrices.length >= 14) {
          await savePriceBatch(item.symbol, yahooPrices);
          prices = yahooPrices;
        }
      } catch (yahooErr) {
        console.warn(
          `[${item.symbol}] Yahoo fetch failed, using cache (${prices.length} bars):`,
          yahooErr instanceof Error ? yahooErr.message : String(yahooErr),
        );
      }
    }
    if (prices.length < 14) {
      console.warn(`[${item.symbol}] insufficient history: ${prices.length}`);
      return null;
    }

    const history = prices.slice(-HISTORY_DAYS);
    const currentPrice = history.at(-1)?.close ?? 0;

    // b. Compute indicators.
    const indicators = computeIndicators(history);

    // c. Baseline (SMA-drift).
    const baseline = smaDriftBaseline(history, HORIZON_DAYS);

    // d. LLM prediction.
    const llmResult = await predictionEngineTool.execute({
      context: {
        symbol: item.symbol,
        history,
        ...indicators,
      },
      runtimeContext: new RuntimeContext(),
    });

    // e. After-tax return.
    const taxResult = await predictionTaxTool.execute({
      context: {
        currentPrice,
        predictedPrice: llmResult.predictedPrice,
        distPolicy: item.distPolicy,
        currency: item.currency,
      },
      runtimeContext: new RuntimeContext(),
    });

    // f. Signal.
    const signalResult = await predictionSignalTool.execute({
      context: {
        direction: llmResult.direction,
        afterTaxReturnPct: taxResult.afterTaxReturnPct,
      },
      runtimeContext: new RuntimeContext(),
    });

    return {
      symbol: item.symbol,
      targetDate: getTargetDate(),
      horizonDays: HORIZON_DAYS,
      currency: item.currency,
      currentPrice,
      predictedPrice: llmResult.predictedPrice,
      confidence: llmResult.confidence,
      direction: llmResult.direction,
      reasoning: llmResult.reasoning,
      afterTaxReturnPct: taxResult.afterTaxReturnPct,
      signal: signalResult.signal,
      alternativeSymbol: null,
      alternativeAfterTaxReturnPct: null,
      baselinePredictedPrice: baseline.predictedPrice,
      baselineDirection: baseline.direction,
    };
  } catch (err) {
    console.error(`[${item.symbol}] prediction failed:`, err);
    return null;
  }
}

/** POST /api/predictions — run prediction pipeline for all watchlist ETFs. */
export async function POST() {
  try {
    const watchlist = await getActiveWatchlist();

    // 1-2. Predict all main tickers IN PARALLEL (was sequential — 7x speedup).
    // Each LLM call is independent, so Promise.all is safe and 5-7x faster.
    const mainResults = await Promise.all(
      watchlist.map((item) => predictTicker(item)),
    );
    const mainPredictions: PredictionSaveInput[] = mainResults.filter(
      (p): p is PredictionSaveInput => p !== null,
    );

    // 3. Process alternatives IN PARALLEL — but only the FIRST alternative
    //    per main ticker to keep total LLM calls under the 60s Vercel limit.
    const altTasks: Promise<void>[] = [];
    for (const item of watchlist) {
      const mainPred = mainPredictions.find((p) => p.symbol === item.symbol);
      if (!mainPred || item.alternatives.length === 0) continue;

      // Only process the first alternative to limit total LLM calls.
      const altSymbol = item.alternatives[0];
      altTasks.push(
        (async () => {
          const altResults: Array<{
            symbol: string;
            afterTaxReturnPct: number;
          }> = [];
          const altWatchlist = await getWatchlistBySymbol(altSymbol);
          if (altWatchlist) {
            const altPred = await predictTicker(altWatchlist);
            if (altPred) {
              altResults.push({
                symbol: altSymbol,
                afterTaxReturnPct: altPred.afterTaxReturnPct ?? 0,
              });
              const best = findBestAlternative(
                item.symbol,
                mainPred.afterTaxReturnPct ?? 0,
                altResults,
              );
              if (best) {
                mainPred.alternativeSymbol = best.symbol;
                mainPred.alternativeAfterTaxReturnPct = best.afterTaxReturnPct;
              }
            }
          }
        })(),
      );
    }
    await Promise.all(altTasks);

    // 5. Save main predictions.
    const savedIds: number[] = [];
    for (const pred of mainPredictions) {
      const id = await savePrediction(pred);
      savedIds.push(id);
    }

    return NextResponse.json({
      predictions: mainPredictions,
      count: mainPredictions.length,
      savedIds,
    });
  } catch (error) {
    console.error("POST /api/predictions error:", error);
    return NextResponse.json(
      { error: "Failed to generate predictions" },
      { status: 500 },
    );
  }
}

/** GET /api/predictions?limit=50 — latest predictions with accuracy stats. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)),
    );

    const predictions: PredictionRecord[] = await getLatestPredictions(limit);

    // Enrich with accuracy stats per symbol.
    const accuracyMap = new Map<
      string,
      { accuracy: number; avgMape: number }
    >();
    for (const pred of predictions) {
      if (accuracyMap.has(pred.symbol)) continue;
      const stats = await getAccuracyBySymbol(pred.symbol, 20);
      accuracyMap.set(pred.symbol, {
        accuracy: stats.accuracy,
        avgMape: stats.avgMape,
      });
    }

    return NextResponse.json({
      predictions: predictions.map((p) => ({
        ...p,
        accuracy: accuracyMap.get(p.symbol)?.accuracy ?? 0,
        avgMape: accuracyMap.get(p.symbol)?.avgMape ?? 0,
      })),
      count: predictions.length,
    });
  } catch (error) {
    console.error("GET /api/predictions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch predictions" },
      { status: 500 },
    );
  }
}
