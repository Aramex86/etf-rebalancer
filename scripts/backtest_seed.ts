// scripts/backtest_seed.ts
//
// Loads 1 year of daily price history from Yahoo Finance for every ETF in
// WATCHLIST_SEED and saves it to the `price_history` table.
//
// Run:  npx tsx scripts/backtest_seed.ts
//
// Idempotent: ON CONFLICT (symbol, date) DO UPDATE in savePriceBatch.
// Rate-limit friendly: 500 ms sleep between tickers.

import { WATCHLIST_SEED } from "@/entities/market-data/model/watchlistSeed";
import { fetchPriceHistory } from "@/entities/market-data/model/yahooFinanceClient";
import { savePriceBatch } from "@/entities/market-data/model/priceHistoryRepository";
import { runMigrations } from "@/shared/lib/migrations";
import { YahooFinanceError } from "@/entities/market-data/model/marketDataTypes";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TickerResult {
  symbol: string;
  yahooSymbol: string;
  rows: number;
  minDate: string | null;
  maxDate: string | null;
  error: string | null;
}

async function main(): Promise<void> {
  console.log("=== backtest_seed: loading 1y price history ===\n");

  await runMigrations();

  const results: TickerResult[] = [];

  for (const item of WATCHLIST_SEED) {
    process.stdout.write(`Fetching ${item.symbol} (${item.yahooSymbol}) ... `);

    try {
      const prices = await fetchPriceHistory(item.yahooSymbol, "1y", "1d");

      if (prices.length === 0) {
        console.log("NO DATA");
        results.push({
          symbol: item.symbol,
          yahooSymbol: item.yahooSymbol,
          rows: 0,
          minDate: null,
          maxDate: null,
          error: "No data returned by Yahoo",
        });
        await sleep(500);
        continue;
      }

      await savePriceBatch(item.symbol, prices);

      const minDate = prices[0]?.date ?? null;
      const maxDate = prices[prices.length - 1]?.date ?? null;

      console.log(`${prices.length} rows  [${minDate} → ${maxDate}]`);
      results.push({
        symbol: item.symbol,
        yahooSymbol: item.yahooSymbol,
        rows: prices.length,
        minDate,
        maxDate,
        error: null,
      });
    } catch (err) {
      let msg: string;
      if (err instanceof YahooFinanceError) {
        msg = `YahooFinanceError [${err.statusCode}]: ${err.message}`;
      } else if (err instanceof Error) {
        msg = err.message;
      } else {
        msg = String(err);
      }
      console.log(`ERROR: ${msg}`);
      results.push({
        symbol: item.symbol,
        yahooSymbol: item.yahooSymbol,
        rows: 0,
        minDate: null,
        maxDate: null,
        error: msg,
      });
      // Continue to next ticker — don't abort the whole run.
    }

    await sleep(500);
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(
    "Symbol  YahooSym      Rows   MinDate       MaxDate       Status",
  );
  console.log(
    "------  ----------    -----  -----------   -----------   ------",
  );
  for (const r of results) {
    console.log(
      `${r.symbol.padEnd(6)}  ${r.yahooSymbol.padEnd(12)}  ${String(r.rows).padStart(5)}  ${(r.minDate ?? "-").padEnd(11)}  ${(r.maxDate ?? "-").padEnd(11)}  ${r.error ?? "OK"}`,
    );
  }

  const totalRows = results.reduce((sum, r) => sum + r.rows, 0);
  const failed = results.filter((r) => r.error !== null).length;
  console.log(
    `\nTotal rows: ${totalRows} | Tickers OK: ${results.length - failed} | Failed: ${failed}`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
