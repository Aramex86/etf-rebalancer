// src/entities/market-data/model/watchlistSeed.ts

import type { WatchlistItemInput } from "./watchlistRepository";

/**
 * Initial watchlist of 7 UCITS ETFs (plus GLDM which is US-listed).
 *
 * `yahoo_symbol` includes the exchange suffix for Yahoo Finance API.
 * Synchronised with the ETF_UNIVERSE in `entities/etf`.
 */
export const WATCHLIST_SEED: WatchlistItemInput[] = [
  {
    symbol: "SWRD",
    yahooSymbol: "SWRD.L",
    name: "iShares Core MSCI World UCITS ETF",
    category: "equity",
    currency: "USD",
    distPolicy: "acc",
    alternatives: ["VWCE.L"],
  },
  {
    symbol: "EIMI",
    yahooSymbol: "EIMI.L",
    name: "iShares Core MSCI EM IMI UCITS ETF",
    category: "equity",
    currency: "USD",
    distPolicy: "acc",
    alternatives: ["EMIM.L"],
  },
  {
    symbol: "DPYA",
    yahooSymbol: "DPYA.L",
    name: "iShares MSCI World Small Cap UCITS ETF",
    category: "equity",
    currency: "USD",
    distPolicy: "acc",
    alternatives: ["IUSN.DE"],
  },
  {
    symbol: "VDTA",
    yahooSymbol: "VDTA.L",
    name: "Vanguard FTSE Developed Europe UCITS ETF",
    category: "equity",
    currency: "USD",
    distPolicy: "dist",
    alternatives: ["VEVE.L"],
  },
  {
    symbol: "LQDA",
    yahooSymbol: "LQDA.L",
    name: "iShares $ Corp Bond UCITS ETF",
    category: "bond",
    currency: "USD",
    distPolicy: "acc",
    alternatives: ["AGBP.L"],
  },
  {
    symbol: "IDVY",
    yahooSymbol: "IDVY.L",
    name: "iShares Euro Dividend UCITS ETF",
    category: "equity",
    currency: "EUR",
    distPolicy: "dist",
    alternatives: ["VHYL.L"],
  },
  {
    symbol: "GLDM",
    yahooSymbol: "GLDM",
    name: "SPDR Gold MiniShares Trust",
    category: "commodity",
    currency: "USD",
    distPolicy: "acc",
    alternatives: ["SGLN.L"],
  },
];
