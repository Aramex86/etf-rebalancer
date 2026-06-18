export interface ETFPosition {
  symbol: string;
  value: number;
}

export interface ETFPortfolio {
  totalValue: number;
  positions: Record<string, number>;
}

export interface ETFAllocation {
  symbol: string;
  target: number;
}

export interface ETFRecommendation {
  symbol: string;
  target: number;
  currentWeight: number;
  deviation: number;
  amount: number;
  shares: number;
  newWeight: number;
}

export interface ETFPrices {
  [symbol: string]: number;
}

export interface ETFInstrument {
  symbol: string;
  name: string;
  targetAllocation: number;
  price: number;
}

export interface RebalanceThresholds {
  ignore: number;
  consider: number;
  action: number;
}

export interface PortfolioAnalysis {
  symbol: string;
  name: string;
  currentValue: number;
  currentWeight: number;
  targetWeight: number;
  deviation: number;
  status: "ignore" | "consider" | "action";
}
