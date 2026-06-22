export {
  analyzePortfolio,
  calculateAllocation,
  CURRENT_PORTFOLIO,
  CURRENT_PRICES,
  ETF_UNIVERSE,
  getEffectiveTargetAllocations,
  getEffectivePrices,
  getRebalanceStatus,
  MIN_INVESTMENT,
  REBALANCE_THRESHOLDS,
  TARGET_ALLOCATIONS,
} from "./model/etfRules";
export type {
  ETFAllocation,
  ETFInstrument,
  ETFPortfolio,
  ETFPosition,
  ETFPrices,
  ETFRecommendation,
  PortfolioAnalysis,
  RebalanceThresholds,
} from "./model/etfTypes";
