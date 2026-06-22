// src/entities/market-data/model/yahooHistoryTool.ts

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { fetchPriceHistory } from "./yahooFinanceClient";
import { savePriceBatch } from "./priceHistoryRepository";
import { getWatchlistBySymbol } from "./watchlistRepository";

/**
 * Mastra tool: fetch price history from Yahoo Finance and cache to DB.
 * Input: { symbol, range } where symbol is the internal watchlist symbol.
 * Output: { symbol, prices, count }.
 */
export const yahooHistoryTool = createTool({
  id: "get-price-history",
  description:
    "Получает историю цен ETF из Yahoo Finance и сохраняет в БД. " +
    "Возвращает массив точек { date, close }.",

  inputSchema: z.object({
    symbol: z.string().describe("Внутренний символ ETF (например SWRD)"),
    range: z
      .enum(["1y", "30d", "7d", "1d"])
      .describe("Период истории")
      .default("30d"),
  }),

  outputSchema: z.object({
    symbol: z.string(),
    prices: z.array(
      z.object({
        date: z.string(),
        close: z.number(),
      }),
    ),
    count: z.number(),
  }),

  execute: async ({ context }) => {
    const { symbol, range } = context;

    // Resolve internal symbol → yahoo_symbol via watchlist.
    const item = await getWatchlistBySymbol(symbol);
    if (!item) {
      return { symbol, prices: [], count: 0 };
    }

    const prices = await fetchPriceHistory(item.yahooSymbol, range, "1d");

    if (prices.length > 0) {
      await savePriceBatch(symbol, prices);
    }

    return {
      symbol,
      prices,
      count: prices.length,
    };
  },
});
