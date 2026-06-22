// src/features/predictions/api/marketData.ts

import type { PricePoint } from "@/shared/types/marketData";

/** Response shape from GET /api/market-data. */
interface MarketDataResponse {
  symbol: string;
  prices: PricePoint[];
  source: "cache" | "yahoo";
}

/**
 * Fetch price history for a symbol from the market-data API.
 * Uses cache-first strategy (server returns cached data if fresh).
 *
 * @param symbol ETF ticker (e.g. "SWRD")
 * @param days Number of days of history (default 30)
 * @param force If true, bypass cache and fetch from Yahoo
 */
export async function fetchMarketData(
  symbol: string,
  days = 30,
  force = false,
): Promise<MarketDataResponse> {
  const params = new URLSearchParams({
    symbol,
    days: String(days),
  });
  if (force) {
    params.set("force", "true");
  }

  const response = await fetch(`/api/market-data?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch market data for ${symbol}`);
  }

  return response.json();
}
