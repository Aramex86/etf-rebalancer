// src/entities/market-data/model/marketDataTypes.ts

/**
 * Type definitions specific to the market-data entity.
 *
 * `WatchlistItem` is defined in `watchlistRepository.ts` and re-exported
 * from the entity barrel. This file holds types that don't belong to the
 * repository layer (e.g. error classes).
 */

/** Error thrown when Yahoo Finance API requests fail. */
export class YahooFinanceError extends Error {
  /** HTTP status code (0 if request never completed). */
  readonly statusCode: number;
  /** Yahoo symbol that was queried. */
  readonly symbol: string;

  constructor(message: string, statusCode: number, symbol: string) {
    super(`YahooFinanceError [${statusCode}] for ${symbol}: ${message}`);
    this.name = "YahooFinanceError";
    this.statusCode = statusCode;
    this.symbol = symbol;
  }
}
