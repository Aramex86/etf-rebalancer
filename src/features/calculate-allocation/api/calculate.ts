import {
  applyPortfolioPrices,
  calculateAllocation,
  CURRENT_PORTFOLIO,
  ETFRecommendation,
  getEffectiveTargetAllocations,
} from "@/entities/etf";
import { ETFPortfolio, ETFPrices } from "@/entities/etf/model/etfTypes";

export async function calculateAllocationFeature(
  amount: number,
  portfolio?: ETFPortfolio | null,
): Promise<ETFRecommendation[]> {
  const targetAllocations = await getEffectiveTargetAllocations();
  const prices: ETFPrices = { ...(portfolio?.prices ?? {}) };

  const response = await fetch("/api/portfolio-rules");
  if (!response.ok) {
    throw new Error("Failed to fetch ETF prices for allocation");
  }

  const data = (await response.json()) as {
    rules: Array<{ symbol: string; price: number | null }>;
  };
  for (const rule of data.rules) {
    if (rule.price !== null && rule.price > 0) {
      prices[rule.symbol] = rule.price;
    }
  }

  const effectivePortfolio = applyPortfolioPrices(
    portfolio || CURRENT_PORTFOLIO,
    prices,
  );
  return calculateAllocation(
    effectivePortfolio,
    amount,
    prices,
    targetAllocations,
  );
}

export { applyPortfolioPrices, calculateAllocation };
