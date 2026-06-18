import {
  calculateAllocation,
  ETFRecommendation,
  getEffectiveTargetAllocations,
} from "@/entities/etf";
import { ETFPortfolio } from "@/entities/etf/model/etfTypes";

export async function calculateAllocationFeature(
  amount: number,
  portfolio?: ETFPortfolio | null,
): Promise<ETFRecommendation[]> {
  const targetAllocations = await getEffectiveTargetAllocations();
  const effectivePortfolio = portfolio || {
    totalValue: 16699.07,
    positions: {
      SWRD: 9968.29,
      EIMI: 1154.37,
      DPYA: 825.17,
      VDTA: 1517.1,
      LQDA: 1550.29,
      IDVY: 206.04,
      GLDM: 1477.81,
    },
  };
  return calculateAllocation(
    effectivePortfolio,
    amount,
    undefined,
    targetAllocations,
  );
}

export { calculateAllocation };
