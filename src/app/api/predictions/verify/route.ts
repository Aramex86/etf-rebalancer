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
  fetchQuote,
} from "@/entities/market-data";

/** POST /api/predictions/verify — verify unverified predictions against actual prices. */
export async function POST() {
  try {
    const unverified: PredictionRecord[] = await getUnverifiedPredictions();

    if (unverified.length === 0) {
      return NextResponse.json({
        verified: 0,
        accuracy: 0,
        avgMape: 0,
        message: "No unverified predictions found",
      });
    }

    const verifiedRecords: PredictionRecord[] = [];

    for (const pred of unverified) {
      try {
        // a. Try to get actual price from DB (cache).
        let actualPricePoint = await getPriceOnDate(
          pred.symbol,
          pred.targetDate,
        );

        // b. Fallback: fetch current quote from Yahoo if DB has no price for target date.
        if (!actualPricePoint) {
          const watchlistItem = await getWatchlistBySymbol(pred.symbol);
          if (watchlistItem) {
            const quote = await fetchQuote(watchlistItem.yahooSymbol);
            actualPricePoint = {
              date: pred.targetDate,
              close: quote.price,
            };
          }
        }

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
