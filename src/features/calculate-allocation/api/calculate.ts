import {
  calculateAllocation,
  CURRENT_PORTFOLIO,
  ETFRecommendation,
  getEffectiveTargetAllocations,
  getEffectivePrices,
} from "@/entities/etf";
import { ETFPortfolio } from "@/entities/etf/model/etfTypes";

export async function calculateAllocationFeature(
  amount: number,
  portfolio?: ETFPortfolio | null,
): Promise<ETFRecommendation[]> {
  const targetAllocations = await getEffectiveTargetAllocations();
  const prices = await getEffectivePrices();
  const effectivePortfolio = portfolio || CURRENT_PORTFOLIO;
  return calculateAllocation(
    effectivePortfolio,
    amount,
    prices,
    targetAllocations,
  );
}

export { calculateAllocation };
