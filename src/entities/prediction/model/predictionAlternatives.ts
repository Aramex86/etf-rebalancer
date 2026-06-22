// src/entities/prediction/model/predictionAlternatives.ts

import { predictionConfig } from "@/shared/lib/predictionConfig";

/**
 * Find the best alternative ETF based on after-tax return.
 *
 * An alternative is only recommended if its after-tax return is better
 * than the main ETF's return by more than the configured threshold (default 0.5%).
 *
 * @param mainSymbol           Main ETF symbol.
 * @param mainAfterTaxReturnPct  After-tax return % of the main ETF.
 * @param alternatives         Array of { symbol, afterTaxReturnPct } for alternatives.
 * @returns The best alternative, or null if none is significantly better.
 */
export function findBestAlternative(
  mainSymbol: string,
  mainAfterTaxReturnPct: number,
  alternatives: Array<{ symbol: string; afterTaxReturnPct: number }>,
): { symbol: string; afterTaxReturnPct: number } | null {
  if (alternatives.length === 0) return null;

  /** Minimum improvement threshold (from config, default 0.5%). */
  const MIN_IMPROVEMENT_PCT = predictionConfig.prediction.minImprovementPct;

  let best: { symbol: string; afterTaxReturnPct: number } | null = null;

  for (const alt of alternatives) {
    if (alt.symbol === mainSymbol) continue;
    if (alt.afterTaxReturnPct - mainAfterTaxReturnPct > MIN_IMPROVEMENT_PCT) {
      if (!best || alt.afterTaxReturnPct > best.afterTaxReturnPct) {
        best = alt;
      }
    }
  }

  return best;
}
