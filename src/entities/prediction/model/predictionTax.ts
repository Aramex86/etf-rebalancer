// src/entities/prediction/model/predictionTax.ts

import { predictionConfig } from "@/shared/lib/predictionConfig";

/** Distribution policy: "acc" (accumulating) or "dist" (distributing). */
export type DistPolicy = "acc" | "dist";

/** Result of after-tax return calculation. */
export interface AfterTaxReturnResult {
  /** Gross return (predictedPrice - currentPrice). */
  grossReturn: number;
  /** Net return after capital gains tax (and withholding for dist ETFs). */
  afterTaxReturn: number;
  /** After-tax return as percentage of current price. */
  afterTaxReturnPct: number;
  /** Warning if currency is not USD (MVP assumption). */
  warning: string | null;
}

/**
 * Calculate after-tax return for a Moldova resident.
 *
 * Tax rules (Moldova):
 * - Capital gains tax: 12% on profits (only if grossReturn > 0).
 * - UCITS withholding tax: 15% on distributing ETF dividends
 *   (simplified: applied as a haircut on positive returns for dist ETFs).
 *
 * @param currentPrice   Current price per share.
 * @param predictedPrice Predicted price per share (7 days ahead).
 * @param distPolicy     "acc" or "dist".
 * @param currency       ISO currency code (MVP assumes USD portfolio).
 */
export function calcAfterTaxReturn(
  currentPrice: number,
  predictedPrice: number,
  distPolicy: DistPolicy,
  currency: string = "USD",
): AfterTaxReturnResult {
  const { capitalGains, withholding } = predictionConfig.tax;

  const grossReturn = predictedPrice - currentPrice;

  // Capital gains tax only on profits — losses are not taxed.
  const afterCapitalGains =
    grossReturn > 0 ? grossReturn * (1 - capitalGains) : grossReturn;

  // Withholding tax on distributing ETFs (simplified haircut on positive returns).
  const afterTaxReturn =
    distPolicy === "dist" && afterCapitalGains > 0
      ? afterCapitalGains * (1 - withholding)
      : afterCapitalGains;

  const afterTaxReturnPct = (afterTaxReturn / currentPrice) * 100;

  const warning =
    currency !== "USD"
      ? `Currency ${currency} not converted — assuming USD portfolio (MVP)`
      : null;

  return {
    grossReturn,
    afterTaxReturn,
    afterTaxReturnPct,
    warning,
  };
}
