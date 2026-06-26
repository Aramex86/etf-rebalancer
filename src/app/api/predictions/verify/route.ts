// src/app/api/predictions/verify/route.ts

import { NextResponse } from "next/server";
import {
  getUnverifiedPredictions,
  markVerified,
  verifyPrediction,
  calcAccuracyStats,
  type PredictionRecord,
} from "@/entities/prediction";
import {
  getPriceOnDate,
  getWatchlistBySymbol,
  fetchPriceHistory,
  savePriceBatch,
} from "@/entities/market-data";

/**
 * Resolve the actual closing price for a prediction's target date.
 *
 * 1. Check DB cache (price_history table).
 * 2. If missing, fetch 30d history from Yahoo, cache it, then re-read.
 *
 * We must NOT use fetchQuote() — it returns today's price, not the price
 * on targetDate. Fetching a 30d window covers the target date (which is
 * in the past by the time we verify).
 *
 * @returns The actual price point, or null if it could not be resolved.
 */
async function resolveActualPrice(
  pred: PredictionRecord,
): Promise<{ date: string; close: number } | null> {
  // a. Try DB cache first.
  const cached = await getPriceOnDate(pred.symbol, pred.targetDate);
  if (cached) return cached;

  // b. Fallback: fetch 30d history from Yahoo, cache it, then re-read.
  const watchlistItem = await getWatchlistBySymbol(pred.symbol);
  if (!watchlistItem) return null;

  try {
    const yahooPrices = await fetchPriceHistory(
      watchlistItem.yahooSymbol,
      "30d",
      "1d",
    );
    if (yahooPrices.length === 0) return null;

    await savePriceBatch(pred.symbol, yahooPrices);
    // Re-read from DB so the date format matches exactly.
    return await getPriceOnDate(pred.symbol, pred.targetDate);
  } catch (yahooErr) {
    console.warn(
      `[verify ${pred.symbol}] Yahoo fetch failed:`,
      yahooErr instanceof Error ? yahooErr.message : String(yahooErr),
    );
    return null;
  }
}

/** POST /api/predictions/verify — verify unverified predictions against actual prices. */
export async function POST() {
  try {
    const unverified: PredictionRecord[] = await getUnverifiedPredictions();

    if (unverified.length === 0) {
      return NextResponse.json({
        verified: 0,
        total: 0,
        directionCorrect: 0,
        accuracy: 0,
        avgMape: 0,
        message: "No unverified predictions found",
      });
    }

    const verifiedRecords: PredictionRecord[] = [];

    for (const pred of unverified) {
      try {
        const actualPricePoint = await resolveActualPrice(pred);

        if (!actualPricePoint) {
          console.warn(
            `[verify ${pred.symbol}] no actual price available for ${pred.targetDate}`,
          );
          continue;
        }

        // c. Verify prediction.
        const result = verifyPrediction(pred, actualPricePoint.close);

        // d. Mark as verified in DB.
        await markVerified(pred.id, result);

        verifiedRecords.push({
          ...pred,
          actualPrice: result.actualPrice,
          actualDirection: result.actualDirection,
          directionCorrect: result.directionCorrect,
          errorPct: result.errorPct,
          mape: result.mape,
          verifiedAt: new Date(),
        });
      } catch (err) {
        console.error(
          `[verify ${pred.symbol}] failed:`,
          err instanceof Error ? err.message : String(err),
        );
        // Continue to next prediction — don't abort the whole run.
      }
    }

    // 3. Calculate accuracy stats for this batch.
    const stats = calcAccuracyStats(verifiedRecords);

    return NextResponse.json({
      verified: verifiedRecords.length,
      accuracy: stats.accuracy,
      avgMape: stats.avgMape,
      directionCorrect: stats.directionCorrect,
      total: stats.total,
    });
  } catch (error) {
    console.error("POST /api/predictions/verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify predictions" },
      { status: 500 },
    );
  }
}
