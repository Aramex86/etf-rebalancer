// src/entities/market-data/index.ts — public API

export {
  getActiveWatchlist,
  getWatchlistBySymbol,
  upsertWatchlistItem,
} from "./model/watchlistRepository";
export type {
  WatchlistItem,
  WatchlistItemInput,
} from "./model/watchlistRepository";

export {
  savePriceBatch,
  getPriceHistory,
  getPriceOnDate,
  getLatestPriceDate,
  getAllPriceHistory,
} from "./model/priceHistoryRepository";

export { WATCHLIST_SEED } from "./model/watchlistSeed";

export { fetchPriceHistory, fetchQuote } from "./model/yahooFinanceClient";
export type { YahooRange, YahooQuote } from "./model/yahooFinanceClient";

export { YahooFinanceError } from "./model/marketDataTypes";

export { yahooHistoryTool } from "./model/yahooHistoryTool";
