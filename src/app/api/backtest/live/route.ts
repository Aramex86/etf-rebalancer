// src/app/api/backtest/live/route.ts

import { NextResponse } from "next/server";
import { runMigrations } from "@/shared/lib/migrations";
import { fetchPriceHistory } from "@/entities/market-data/model/yahooFinanceClient";
import { savePriceBatch } from "@/entities/market-data/model/priceHistoryRepository";
import { WATCHLIST_SEED } from "@/entities/market-data/model/watchlistSeed";
import type { PricePoint } from "@/shared/types/marketData";
import {
  getLivePortfolio,
  resetLivePortfolio,
  updateLivePortfolio,
  insertLiveTrade,
  upsertLiveSnapshot,
  listLiveTrades,
  listLiveSnapshots,
  listCompletedRunSummaries,
  computeMarketContext,
  buildSystemPrompt,
  buildUserPrompt,
  parseAgentResponse,
  calcCommission,
  DEFAULT_PARAMS,
  type PortfolioState,
  type AgentContext,
  type AgentAction,
  type PastRunSummary,
} from "@/entities/backtest";
import { callOllamaChat } from "@/shared/lib/ollama";

export const runtime = "nodejs";
export const maxDuration = 60;

interface LivePosition {
  symbol: string;
  shares: number;
  avgPrice: number;
}

interface LiveTradeRow {
  date: string;
  symbol: string;
  action: "buy" | "sell";
  shares: number;
  price: number;
  amountUsd: number;
  commission: number;
  tax: number | null;
  realizedPnl: number | null;
  cashAfter: number;
  reasoning: string | null;
}

/** Fetch fresh 30-day prices from Yahoo for all watchlist ETFs. */
async function fetchFreshPrices(): Promise<{
  histories: Map<string, PricePoint[]>;
  activeSymbols: string[];
}> {
  const histories = new Map<string, PricePoint[]>();
  const activeSymbols: string[] = [];

  for (const item of WATCHLIST_SEED) {
    try {
      const prices = await fetchPriceHistory(item.yahooSymbol, "30d", "1d");
      if (prices.length >= 15) {
        histories.set(item.symbol, prices);
        activeSymbols.push(item.symbol);
        // Cache in DB.
        await savePriceBatch(item.symbol, prices);
      }
    } catch {
      // Skip symbol on error.
    }
  }

  return { histories, activeSymbols };
}

/** Execute a buy action on the live portfolio. */
function executeLiveBuy(
  action: AgentAction,
  portfolio: PortfolioState,
  price: number,
  date: string,
  reasoning: string | null,
): LiveTradeRow | null {
  const amountUsd = action.amountUsd ?? 0;
  const commission = calcCommission(amountUsd, DEFAULT_PARAMS);
  const fillPrice = price * (1 + DEFAULT_PARAMS.spreadPct);
  const shares = Math.floor(amountUsd / fillPrice);

  if (shares <= 0) return null;
  const actualAmount = shares * fillPrice;
  const cashAfter = portfolio.cash - actualAmount - commission;
  if (cashAfter < 0) return null;

  return {
    date,
    symbol: action.symbol,
    action: "buy",
    shares,
    price: fillPrice,
    amountUsd: actualAmount,
    commission,
    tax: null,
    realizedPnl: null,
    cashAfter,
    reasoning,
  };
}

/** Execute a sell action on the live portfolio. */
function executeLiveSell(
  action: AgentAction,
  portfolio: PortfolioState,
  price: number,
  date: string,
  reasoning: string | null,
): LiveTradeRow | null {
  const shares = action.shares ?? 0;
  const position = portfolio.positions.find((p) => p.symbol === action.symbol);
  if (!position || shares <= 0 || shares > position.shares) return null;

  const fillPrice = price * (1 - DEFAULT_PARAMS.spreadPct);
  const amountUsd = shares * fillPrice;
  const commission = calcCommission(amountUsd, DEFAULT_PARAMS);
  const costBasis = shares * position.avgPrice;
  const grossPnl = amountUsd - costBasis;
  const tax = grossPnl > 0 ? grossPnl * DEFAULT_PARAMS.taxPct : 0;
  const cashAfter = portfolio.cash + amountUsd - commission - tax;

  return {
    date,
    symbol: action.symbol,
    action: "sell",
    shares,
    price: fillPrice,
    amountUsd,
    commission,
    tax,
    realizedPnl: grossPnl - tax,
    cashAfter,
    reasoning,
  };
}

/**
 * POST /api/backtest/live
 *
 * Executes one live trading step:
 * 1. Fetch fresh prices from Yahoo Finance (last 30 days).
 * 2. Build agent context with current portfolio + market data.
 * 3. Call LLM for buy/sell/hold decisions.
 * 4. Execute trades at real current prices.
 * 5. Save trades + snapshot to DB.
 *
 * Response: { date, cash, totalValue, actions, reasoning, pnlUsd, pnlPct }
 */
export async function POST(request: Request) {
  try {
    await runMigrations();

    const body = await request.json().catch(() => ({}));
    const model = body.model ?? "gemma4:31b-cloud";

    // 1. Fetch fresh prices.
    const { histories, activeSymbols } = await fetchFreshPrices();
    if (activeSymbols.length === 0) {
      return NextResponse.json(
        { error: "No price data available from Yahoo Finance" },
        { status: 502 },
      );
    }

    // 2. Load current live portfolio.
    const livePortfolio = await getLivePortfolio();
    const portfolio: PortfolioState = {
      cash: livePortfolio.cash,
      positions: livePortfolio.positions,
    };

    // 3. Build agent context.
    const today = new Date().toISOString().slice(0, 10);
    const markets = activeSymbols.map((symbol) => {
      const history = histories.get(symbol)!;
      return computeMarketContext(symbol, history);
    });

    // Build positions with current market values.
    const positions = portfolio.positions.map((pos) => {
      const history = histories.get(pos.symbol);
      const currentPrice = history
        ? history[history.length - 1].close
        : pos.avgPrice;
      const marketValue = pos.shares * currentPrice;
      const unrealizedPnl = (currentPrice - pos.avgPrice) * pos.shares;
      return {
        symbol: pos.symbol,
        shares: pos.shares,
        avgPrice: pos.avgPrice,
        marketValue,
        unrealizedPnl,
      };
    });

    const totalValue =
      portfolio.cash + positions.reduce((s, p) => s + p.marketValue, 0);
    const startingCapital = livePortfolio.startingCapital;
    const pnlUsd = totalValue - startingCapital;
    const pnlPct = startingCapital > 0 ? (pnlUsd / startingCapital) * 100 : 0;

    // Recent trades (last 4).
    const recentTradesRaw = await listLiveTrades(4);
    const recentTrades = recentTradesRaw.reverse().map((t) => ({
      week: 0, // Live mode has no week numbers.
      symbol: t.symbol,
      action: t.action,
      shares: t.shares,
      price: t.price,
      realizedPnl: t.realizedPnl,
    }));

    // Past runs for feedback loop.
    const pastRuns: PastRunSummary[] = await listCompletedRunSummaries(
      undefined,
      5,
    );

    const context: AgentContext = {
      week: 0,
      totalWeeks: 0,
      date: today,
      markets,
      portfolio: {
        cash: portfolio.cash,
        positions,
        totalValue,
        startingCapital,
        pnlUsd,
        pnlPct,
      },
      recentTrades,
      pastRuns,
    };

    // 4. Call LLM.
    const messages = [
      { role: "system" as const, content: buildSystemPrompt() },
      { role: "user" as const, content: buildUserPrompt(context) },
    ];

    let agentResponse = null;
    let reasoning: string | null = null;
    try {
      const rawResponse = await callOllamaChat(model, messages);
      agentResponse = parseAgentResponse(rawResponse);
      reasoning = agentResponse?.reasoning ?? null;
    } catch {
      agentResponse = null;
    }

    // 5. Execute trades at current (latest) prices.
    const executedTrades: LiveTradeRow[] = [];
    let currentCash = portfolio.cash;
    let currentPositions = [...portfolio.positions];

    if (agentResponse) {
      for (const action of agentResponse.actions) {
        if (action.action === "hold") continue;

        const history = histories.get(action.symbol);
        if (!history || history.length === 0) continue;
        const currentPrice = history[history.length - 1].close;

        const currentPortfolio: PortfolioState = {
          cash: currentCash,
          positions: currentPositions,
        };

        let trade: LiveTradeRow | null = null;
        if (action.action === "buy") {
          trade = executeLiveBuy(
            action,
            currentPortfolio,
            currentPrice,
            today,
            reasoning,
          );
        } else if (action.action === "sell") {
          trade = executeLiveSell(
            action,
            currentPortfolio,
            currentPrice,
            today,
            reasoning,
          );
        }

        if (trade) {
          executedTrades.push(trade);
          currentCash = trade.cashAfter;

          // Update positions.
          if (trade.action === "buy") {
            const existing = currentPositions.find(
              (p) => p.symbol === trade!.symbol,
            );
            if (existing) {
              const totalShares = existing.shares + trade.shares;
              const totalCost =
                existing.shares * existing.avgPrice +
                trade.shares * trade.price;
              currentPositions = currentPositions.map((p) =>
                p.symbol === trade!.symbol
                  ? {
                      symbol: p.symbol,
                      shares: totalShares,
                      avgPrice: totalCost / totalShares,
                    }
                  : p,
              );
            } else {
              currentPositions.push({
                symbol: trade.symbol,
                shares: trade.shares,
                avgPrice: trade.price,
              });
            }
          } else {
            const pos = currentPositions.find(
              (p) => p.symbol === trade!.symbol,
            );
            if (pos) {
              const remaining = pos.shares - trade.shares;
              if (remaining > 0) {
                currentPositions = currentPositions.map((p) =>
                  p.symbol === trade!.symbol
                    ? {
                        symbol: p.symbol,
                        shares: remaining,
                        avgPrice: p.avgPrice,
                      }
                    : p,
                );
              } else {
                currentPositions = currentPositions.filter(
                  (p) => p.symbol !== trade!.symbol,
                );
              }
            }
          }
        }
      }
    }

    // 6. Save to DB.
    for (const trade of executedTrades) {
      await insertLiveTrade(trade);
    }

    await updateLivePortfolio(currentCash, currentPositions);

    // Save daily snapshot.
    const snapshotPositions = currentPositions.map((pos) => {
      const history = histories.get(pos.symbol);
      const price = history ? history[history.length - 1].close : pos.avgPrice;
      return {
        symbol: pos.symbol,
        shares: pos.shares,
        avgPrice: pos.avgPrice,
        marketValue: pos.shares * price,
        unrealizedPnl: (price - pos.avgPrice) * pos.shares,
      };
    });

    const newTotalValue =
      currentCash + snapshotPositions.reduce((s, p) => s + p.marketValue, 0);

    await upsertLiveSnapshot({
      date: today,
      cash: currentCash,
      positions: snapshotPositions,
      totalValue: newTotalValue,
    });

    // 7. Compute trade stats from all live trades.
    const allTrades = await listLiveTrades(1000);
    const sellTrades = allTrades.filter((t) => t.action === "sell");
    const wins = sellTrades.filter((t) => (t.realizedPnl ?? 0) > 0);
    const losses = sellTrades.filter((t) => (t.realizedPnl ?? 0) < 0);
    const totalRealizedPnl = sellTrades.reduce(
      (s, t) => s + (t.realizedPnl ?? 0),
      0,
    );
    const totalCommissions = allTrades.reduce((s, t) => s + t.commission, 0);
    const totalTax = allTrades.reduce((s, t) => s + (t.tax ?? 0), 0);
    const tradeStats = {
      totalTrades: allTrades.length,
      totalBuys: allTrades.filter((t) => t.action === "buy").length,
      totalSells: sellTrades.length,
      wins: wins.length,
      losses: losses.length,
      winRate:
        sellTrades.length > 0 ? (wins.length / sellTrades.length) * 100 : 0,
      totalRealizedPnl,
      totalCommissions,
      totalTax,
      bestTradePnl: sellTrades.reduce(
        (best, t) => Math.max(best, t.realizedPnl ?? 0),
        0,
      ),
      worstTradePnl: sellTrades.reduce(
        (worst, t) => Math.min(worst, t.realizedPnl ?? 0),
        0,
      ),
    };

    // 8. Return result.
    return NextResponse.json({
      date: today,
      cash: currentCash,
      totalValue: newTotalValue,
      startingCapital,
      pnlUsd: newTotalValue - startingCapital,
      pnlPct:
        startingCapital > 0
          ? ((newTotalValue - startingCapital) / startingCapital) * 100
          : 0,
      actions: executedTrades.map((t) => ({
        symbol: t.symbol,
        action: t.action,
        shares: t.shares,
        price: t.price,
        amountUsd: t.amountUsd,
        commission: t.commission,
        tax: t.tax,
        realizedPnl: t.realizedPnl,
      })),
      reasoning,
      markets: markets.map((m) => ({
        symbol: m.symbol,
        currentPrice: m.currentPrice,
        rsi14: m.rsi14,
        sma7: m.sma7,
        sma14: m.sma14,
      })),
      tradeStats,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Live step failed: ${msg}` },
      { status: 500 },
    );
  }
}

/**
 * GET /api/backtest/live
 *
 * Returns the current live portfolio state + recent trades + snapshots.
 */
export async function GET() {
  try {
    await runMigrations();

    const portfolio = await getLivePortfolio();
    const trades = await listLiveTrades(50);
    const snapshots = await listLiveSnapshots(365);

    return NextResponse.json({
      portfolio,
      trades,
      snapshots,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed: ${msg}` }, { status: 500 });
  }
}

/**
 * DELETE /api/backtest/live
 *
 * Reset the live portfolio to a new starting capital.
 */
export async function DELETE(request: Request) {
  try {
    await runMigrations();

    const { searchParams } = new URL(request.url);
    const capitalParam = searchParams.get("capital");
    const capital = capitalParam ? Number.parseFloat(capitalParam) : 1000;

    const portfolio = await resetLivePortfolio(capital);

    return NextResponse.json({ portfolio });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Reset failed: ${msg}` },
      { status: 500 },
    );
  }
}
