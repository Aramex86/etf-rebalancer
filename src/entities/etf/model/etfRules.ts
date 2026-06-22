import { ETFPortfolio, ETFPrices, ETFRecommendation } from "./etfTypes";
import { predictionConfig } from "@/shared/lib/predictionConfig";

export const ETF_UNIVERSE = [
  {
    symbol: "SWRD",
    name: "iShares Core MSCI World UCITS ETF",
    targetAllocation: 0.6,
    price: 52.2,
  },
  {
    symbol: "EIMI",
    name: "iShares Core MSCI EM IMI UCITS ETF",
    targetAllocation: 0.05,
    price: 55.0,
  },
  {
    symbol: "DPYA",
    name: "iShares MSCI World Small Cap UCITS ETF",
    targetAllocation: 0.05,
    price: 6.56,
  },
  {
    symbol: "VDTA",
    name: "Vanguard FTSE Developed Europe UCITS ETF",
    targetAllocation: 0.1,
    price: 27.1,
  },
  {
    symbol: "LQDA",
    name: "iShares $ Corp Bond UCITS ETF",
    targetAllocation: 0.1,
    price: 6.32,
  },
  {
    symbol: "IDVY",
    name: "iShares Euro Dividend UCITS ETF",
    targetAllocation: 0.0,
    price: 25.8,
  },
  {
    symbol: "GLDM",
    name: "SPDR Gold MiniShares Trust",
    targetAllocation: 0.1,
    price: 86.76,
  },
] as const;

export const TARGET_ALLOCATIONS: Record<string, number> = Object.fromEntries(
  ETF_UNIVERSE.map((etf) => [etf.symbol, etf.targetAllocation]),
);

export const CURRENT_PRICES: ETFPrices = Object.fromEntries(
  ETF_UNIVERSE.map((etf) => [etf.symbol, etf.price]),
);

/** Last-resort fallback portfolio (used only when no client data and no DB snapshot). */
export const CURRENT_PORTFOLIO: ETFPortfolio = {
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

// --- Thresholds (config-backed, with hardcoded fallback for SSR safety) ---

/** Minimum trade amount in USD (from config, fallback $50). */
export const MIN_INVESTMENT = predictionConfig.rebalance.minInvestment;

/** Rebalance deviation bands (from config). */
export const REBALANCE_THRESHOLDS = {
  ignore: predictionConfig.rebalance.ignore,
  consider: predictionConfig.rebalance.consider,
  action: predictionConfig.rebalance.action,
};

export function getRebalanceStatus(
  deviation: number,
): "ignore" | "consider" | "action" {
  const absDeviation = Math.abs(deviation);
  if (absDeviation < REBALANCE_THRESHOLDS.ignore) return "ignore";
  if (absDeviation < REBALANCE_THRESHOLDS.consider) return "consider";
  return "action";
}

export async function getEffectiveTargetAllocations(): Promise<
  Record<string, number>
> {
  if (typeof window !== "undefined") {
    return TARGET_ALLOCATIONS;
  }

  try {
    const { getTargetAllocations } = await import("@/entities/portfolio");
    const dbRules = await getTargetAllocations();
    if (Object.keys(dbRules).length > 0) {
      return dbRules;
    }
  } catch (error) {
    console.warn(
      "Failed to load target allocations from DB, using fallback:",
      error,
    );
  }
  return TARGET_ALLOCATIONS;
}

/**
 * Load prices from the database (latest snapshot or portfolio_rules).
 * Falls back to hardcoded CURRENT_PRICES if DB is unavailable or empty.
 */
export async function getEffectivePrices(): Promise<ETFPrices> {
  if (typeof window !== "undefined") {
    return CURRENT_PRICES;
  }

  try {
    const { getLatestSnapshotPrices } = await import("@/entities/portfolio");
    const dbPrices = await getLatestSnapshotPrices();
    if (Object.keys(dbPrices).length > 0) {
      return dbPrices;
    }
  } catch (error) {
    console.warn("Failed to load prices from DB, using fallback:", error);
  }
  return CURRENT_PRICES;
}

export function calculateAllocation(
  portfolio: ETFPortfolio,
  contribution: number,
  prices: ETFPrices = CURRENT_PRICES,
  targetAllocations: Record<string, number> = TARGET_ALLOCATIONS,
  minInvestment: number = MIN_INVESTMENT,
): ETFRecommendation[] {
  const totalAfter = portfolio.totalValue + contribution;
  const recommendations: ETFRecommendation[] = [];
  let remaining = contribution;

  const sorted = Object.entries(targetAllocations)
    .map(([symbol, target]) => {
      const currentValue = portfolio.positions[symbol] || 0;
      const currentWeight =
        portfolio.totalValue > 0 ? currentValue / portfolio.totalValue : 0;
      const deviation = currentWeight - target;
      return { symbol, target, currentWeight, deviation, currentValue };
    })
    .sort((a, b) => a.deviation - b.deviation);

  for (const etf of sorted) {
    if (remaining < minInvestment) break;

    const targetValue = totalAfter * etf.target;
    const needed = Math.max(0, targetValue - etf.currentValue);
    const toInvest = Math.min(remaining, needed);

    if (toInvest < minInvestment) continue;

    const price = prices[etf.symbol];
    if (!price || price <= 0) continue;

    const shares = Math.floor(toInvest / price);

    if (shares === 0) continue;

    const amount = shares * price;
    const newValue = etf.currentValue + amount;
    const newWeight = newValue / totalAfter;

    recommendations.push({
      symbol: etf.symbol,
      target: etf.target,
      currentWeight: etf.currentWeight,
      deviation: etf.deviation,
      amount,
      shares,
      newWeight,
    });

    remaining -= amount;
  }

  return recommendations;
}

export function analyzePortfolio(
  portfolio: ETFPortfolio,
  targetAllocations: Record<string, number> = TARGET_ALLOCATIONS,
) {
  return Object.entries(targetAllocations).map(([symbol, targetWeight]) => {
    const currentValue = portfolio.positions[symbol] || 0;
    const currentWeight =
      portfolio.totalValue > 0 ? currentValue / portfolio.totalValue : 0;
    const deviation = currentWeight - targetWeight;

    return {
      symbol,
      name: ETF_UNIVERSE.find((etf) => etf.symbol === symbol)?.name || symbol,
      currentValue,
      currentWeight,
      targetWeight,
      deviation,
      status: getRebalanceStatus(deviation),
    };
  });
}
