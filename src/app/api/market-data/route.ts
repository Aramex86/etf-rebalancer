// src/app/api/market-data/route.ts

import { NextResponse } from "next/server";
import {
  getWatchlistBySymbol,
  fetchPriceHistory,
  savePriceBatch,
  getPriceHistory,
  getLatestPriceDate,
  YahooFinanceError,
} from "@/entities/market-data";
import type { YahooRange } from "@/entities/market-data";

/** GET /api/market-data?symbol=SWRD&days=30&force=false */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const daysParam = searchParams.get("days");
  const forceParam = searchParams.get("force");

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing required query param: symbol" },
      { status: 400 },
    );
  }

  const days = daysParam ? Math.max(1, parseInt(daysParam, 10) || 30) : 30;
  const force = forceParam === "true";

  // 1. Find watchlist entry → get yahoo_symbol.
  const watchlistItem = await getWatchlistBySymbol(symbol);
  if (!watchlistItem) {
    return NextResponse.json(
      { error: `Symbol ${symbol} not found in watchlist` },
      { status: 404 },
    );
  }

  // 2. Check cache freshness (unless force=true).
  const today = new Date().toISOString().slice(0, 10);
  if (!force) {
    const latestDate = await getLatestPriceDate(symbol);
    if (latestDate === today) {
      const prices = await getPriceHistory(symbol, days);
      return NextResponse.json({
        symbol,
        days,
        prices,
        source: "cache" as const,
      });
    }
  }

  // 3. Fetch from Yahoo.
  const range: YahooRange = days <= 30 ? "30d" : "1y";
  try {
    const prices = await fetchPriceHistory(
      watchlistItem.yahooSymbol,
      range,
      "1d",
    );

    if (prices.length > 0) {
      await savePriceBatch(symbol, prices);
    }

    // Return only the requested number of days (from the freshly fetched data).
    const trimmed = prices.slice(-days);

    return NextResponse.json({
      symbol,
      days,
      prices: trimmed,
      source: "yahoo" as const,
    });
  } catch (err) {
    if (err instanceof YahooFinanceError) {
      return NextResponse.json(
        {
          error: `Yahoo Finance error: ${err.message}`,
          statusCode: err.statusCode,
        },
        { status: 502 },
      );
    }
    console.error("market-data route error:", err);
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 500 },
    );
  }
}
