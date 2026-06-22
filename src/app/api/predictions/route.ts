// src/app/api/predictions/route.ts

import { NextResponse } from "next/server";
import { RuntimeContext } from "@mastra/core/runtime-context";
import {
  getActiveWatchlist,
  getWatchlistBySymbol,
  fetchPriceHistory,
  savePriceBatch,
  getPriceHistory,
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
} from "@/entities/prediction";
import { predictionConfig } from "@/shared/lib/predictionConfig";
import type { PricePoint } from "@/shared/types/marketData";
import type { PredictionRecord } from "@/entities/prediction";

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
    let prices = await getPriceHistory(item.symbol, HISTORY_DAYS);
    if (prices.length < 14) {
      // Cache miss or insufficient — try Yahoo Finance.
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

    // 1-2. Predict each main ticker.
    const mainPredictions: PredictionSaveInput[] = [];
    for (const item of watchlist) {
      const pred = await predictTicker(item);
      if (pred) mainPredictions.push(pred);
    }

    // 3. Predict alternatives for each ticker.
    const altReturnsByMain: Map<
      string,
      Array<{ symbol: string; afterTaxReturnPct: number }>
    > = new Map();

    for (const item of watchlist) {
      const mainPred = mainPredictions.find((p) => p.symbol === item.symbol);
      if (!mainPred || item.alternatives.length === 0) continue;

      const altResults: Array<{
        symbol: string;
        afterTaxReturnPct: number;
      }> = [];

      for (const altSymbol of item.alternatives) {
        // Alternatives are yahoo symbols — we need a watchlist entry.
        // Try to find by yahoo_symbol match, or fetch directly.
        const altWatchlist = await getWatchlistBySymbol(altSymbol);
        if (altWatchlist) {
          const altPred = await predictTicker(altWatchlist);
          if (altPred) {
            altResults.push({
              symbol: altSymbol,
              afterTaxReturnPct: altPred.afterTaxReturnPct ?? 0,
            });
          }
        } else {
          // Fetch history: cache-first, then Yahoo for symbols not in watchlist.
          try {
            let altPrices = await getPriceHistory(altSymbol, HISTORY_DAYS);
            if (altPrices.length < 14) {
              const yahooAlt = await fetchPriceHistory(altSymbol, "30d", "1d");
              if (yahooAlt.length >= 14) {
                await savePriceBatch(altSymbol, yahooAlt);
                altPrices = yahooAlt;
              }
            }
            if (altPrices.length < 14) continue;
            const altHistory = altPrices.slice(-HISTORY_DAYS);
            const altCurrent = altHistory.at(-1)?.close ?? 0;
            const altIndicators = computeIndicators(altHistory);
            const altBaseline = smaDriftBaseline(altHistory, HORIZON_DAYS);
            const altLlm = await predictionEngineTool.execute({
              context: {
                symbol: altSymbol,
                history: altHistory,
                ...altIndicators,
              },
              runtimeContext: new RuntimeContext(),
            });
            const altTax = await predictionTaxTool.execute({
              context: {
                currentPrice: altCurrent,
                predictedPrice: altLlm.predictedPrice,
                distPolicy: "acc",
                currency: "USD",
              },
              runtimeContext: new RuntimeContext(),
            });
            altResults.push({
              symbol: altSymbol,
              afterTaxReturnPct: altTax.afterTaxReturnPct,
            });
            // Save alternative prediction to DB.
            await savePrediction({
              symbol: altSymbol,
              targetDate: getTargetDate(),
              horizonDays: HORIZON_DAYS,
              currency: "USD",
              currentPrice: altCurrent,
              predictedPrice: altLlm.predictedPrice,
              confidence: altLlm.confidence,
              direction: altLlm.direction,
              reasoning: altLlm.reasoning,
              afterTaxReturnPct: altTax.afterTaxReturnPct,
              signal: null,
              alternativeSymbol: null,
              alternativeAfterTaxReturnPct: null,
              baselinePredictedPrice: altBaseline.predictedPrice,
              baselineDirection: altBaseline.direction,
            });
          } catch (err) {
            console.error(`[alt ${altSymbol}] failed:`, err);
          }
        }
      }

      altReturnsByMain.set(item.symbol, altResults);

      // 4. Find best alternative.
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
