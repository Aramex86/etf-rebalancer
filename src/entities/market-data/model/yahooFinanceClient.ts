// src/entities/market-data/model/yahooFinanceClient.ts

import { predictionConfig } from "@/shared/lib/predictionConfig";
import type { PricePoint } from "@/shared/types/marketData";
import { YahooFinanceError } from "./marketDataTypes";

/** Yahoo Finance chart API base URL (from config). */
const YAHOO_CHART_URL = predictionConfig.yahoo.chartURL;

/** Supported range values for the Yahoo chart endpoint. */
export type YahooRange = "1y" | "30d" | "7d" | "1d";

/** Quote returned by fetchQuote(). */
export interface YahooQuote {
  price: number;
  currency: string;
}

/** Internal shape of the Yahoo chart response (only fields we use). */
interface YahooChartResult {
  timestamp?: number[];
  indicators?: {
    // Yahoo returns "adjclose" (lowercase), not "adjClose"
    adjclose?: Array<{ adjclose?: (number | null)[] }>;
    quote?: Array<{
      close?: (number | null)[];
    }>;
  };
  meta?: {
    currency?: string;
    regularMarketPrice?: number;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
    error?: { description?: string };
  };
}

/** Sleep helper for retry backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch price history from Yahoo Finance chart API.
 *
 * @param yahooSymbol Yahoo ticker (e.g. "SWRD.L", "GLDM").
 * @param range Time range: "1y", "30d", "7d", "1d".
 * @param interval Bar interval (default "1d").
 * @returns Array of PricePoint sorted ascending by date. Empty array if no data.
 * @throws YahooFinanceError on 403/429 after one retry, or other HTTP errors.
 */
export async function fetchPriceHistory(
  yahooSymbol: string,
  range: YahooRange,
  interval: "1d" | "1wk" = "1d",
): Promise<PricePoint[]> {
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=${interval}`;

  const data = await fetchYahooChart(url, yahooSymbol);
  const result = data.chart?.result?.[0];
  if (!result) {
    // No data — return empty array, not null.
    return [];
  }

  const timestamps = result.timestamp ?? [];
  // Yahoo returns "adjclose" (lowercase key). Fall back to quote[0].close if missing.
  const adjCloseArr =
    result.indicators?.adjclose?.[0]?.adjclose ??
    result.indicators?.quote?.[0]?.close ??
    [];

  const prices: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = adjCloseArr[i];
    if (close === null || close === undefined || Number.isNaN(close)) continue;
    prices.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      close: close,
    });
  }

  return prices;
}

/**
 * Fetch the current quote (price + currency) for a Yahoo symbol.
 * Uses range=1d which returns the latest trading day.
 *
 * @throws YahooFinanceError on persistent HTTP errors.
 */
export async function fetchQuote(yahooSymbol: string): Promise<YahooQuote> {
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1d`;

  const data = await fetchYahooChart(url, yahooSymbol);
  const result = data.chart?.result?.[0];
  if (!result) {
    throw new YahooFinanceError("No chart result returned", 404, yahooSymbol);
  }

  const meta = result.meta ?? {};
  const closeArr = result.indicators?.quote?.[0]?.close ?? [];
  const lastClose = [...closeArr]
    .reverse()
    .find((v) => v !== null && v !== undefined);

  const price = lastClose ?? meta.regularMarketPrice;
  if (price === undefined || Number.isNaN(price)) {
    throw new YahooFinanceError(
      "Could not extract price from response",
      200,
      yahooSymbol,
    );
  }

  return {
    price,
    currency: meta.currency ?? "USD",
  };
}

/**
 * Low-level fetch with one retry on 403/429.
 * Returns parsed JSON or throws YahooFinanceError.
 */
async function fetchYahooChart(
  url: string,
  yahooSymbol: string,
): Promise<YahooChartResponse> {
  const headers = {
    "User-Agent": predictionConfig.yahoo.userAgent,
  };

  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (err) {
    throw new YahooFinanceError(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
      0,
      yahooSymbol,
    );
  }

  // Retry once on 403/429 after 2s backoff.
  if (response.status === 403 || response.status === 429) {
    await sleep(2000);
    try {
      response = await fetch(url, { headers });
    } catch (err) {
      throw new YahooFinanceError(
        `Network error on retry: ${err instanceof Error ? err.message : String(err)}`,
        0,
        yahooSymbol,
      );
    }
    if (response.status === 403 || response.status === 429) {
      throw new YahooFinanceError(
        `Rate limited or forbidden after retry`,
        response.status,
        yahooSymbol,
      );
    }
  }

  if (!response.ok) {
    throw new YahooFinanceError(
      `HTTP ${response.status} ${response.statusText}`,
      response.status,
      yahooSymbol,
    );
  }

  let data: YahooChartResponse;
  try {
    data = (await response.json()) as YahooChartResponse;
  } catch (err) {
    throw new YahooFinanceError(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      response.status,
      yahooSymbol,
    );
  }

  if (data.chart?.error) {
    throw new YahooFinanceError(
      data.chart.error.description ?? "Unknown chart error",
      200,
      yahooSymbol,
    );
  }

  return data;
}
