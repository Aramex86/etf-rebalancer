import { NextResponse } from "next/server";
import { getLatestPortfolioSnapshot } from "@/entities/portfolio";
import {
  applyPortfolioPrices,
  calculateAllocation,
  getEffectiveTargetAllocations,
  getEffectivePrices,
  CURRENT_PORTFOLIO,
} from "@/entities/etf";
import {
  getWatchlistBySymbol,
  fetchPriceHistory,
} from "@/entities/market-data";
import { predictionConfig } from "@/shared/lib/predictionConfig";
import { callOllamaChat } from "@/shared/lib/ollama";
import type { PricePoint } from "@/shared/types/marketData";

// Force Node.js runtime (required for `pg` driver + Yahoo fetch).
// Extend timeout to 60s — Yahoo fetches for 7 ETFs + LLM call.
export const runtime = "nodejs";
export const maxDuration = 60;

/** Market data for a single ETF (fetched from Yahoo Finance in real-time). */
interface EtfMarketData {
  symbol: string;
  currentPrice: number;
  change30dPct: number;
  sma7: number;
  sma14: number;
  volatility: number;
  high30: number;
  low30: number;
}

/**
 * Compute technical indicators from price history.
 * Mirrors the logic in /api/predictions/route.ts.
 */
function computeIndicators(history: PricePoint[]) {
  const closes = history.map((p) => p.close);

  const sma7 =
    closes.length >= 7
      ? closes.slice(-7).reduce((s, c) => s + c, 0) / 7
      : closes.reduce((s, c) => s + c, 0) / (closes.length || 1);

  const sma14 =
    closes.length >= 14
      ? closes.slice(-14).reduce((s, c) => s + c, 0) / 14
      : closes.reduce((s, c) => s + c, 0) / (closes.length || 1);

  // Daily returns → annualised volatility.
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const meanReturn = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  const variance =
    returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) /
    (returns.length || 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(252);

  const high30 = closes.length ? Math.max(...closes) : 0;
  const low30 = closes.length ? Math.min(...closes) : 0;

  return { sma7, sma14, volatility, high30, low30 };
}

/**
 * Fetch real-time market data for a single ETF from Yahoo Finance.
 * Returns null if the symbol is not in the watchlist or fetch fails.
 */
async function fetchEtfMarketData(
  symbol: string,
): Promise<EtfMarketData | null> {
  try {
    const item = await getWatchlistBySymbol(symbol);
    if (!item) return null;

    // Always fetch from Yahoo (real-time per user preference).
    const history = await fetchPriceHistory(item.yahooSymbol, "30d", "1d");
    if (history.length < 2) return null;

    const currentPrice = history[history.length - 1].close;
    const price30dAgo = history[0].close;
    const change30dPct =
      price30dAgo > 0 ? ((currentPrice - price30dAgo) / price30dAgo) * 100 : 0;

    const indicators = computeIndicators(history);

    return {
      symbol,
      currentPrice,
      change30dPct,
      ...indicators,
    };
  } catch (err) {
    console.error(`Market data fetch failed for ${symbol}:`, err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { portfolio: clientPortfolio, contribution } = await req.json();

    // Получаем портфель (из запроса, БД или хардкод)
    let portfolio = clientPortfolio;
    if (!portfolio) {
      const snapshot = await getLatestPortfolioSnapshot();
      if (snapshot) {
        portfolio = {
          totalValue: snapshot.totalValue,
          positions: snapshot.positions,
          prices: snapshot.prices,
          shares: snapshot.shares,
        };
      }
    }
    if (!portfolio) {
      portfolio = CURRENT_PORTFOLIO;
    }

    // Расчёт напрямую (без Mastra Tool)
    const targetAllocations = await getEffectiveTargetAllocations();
    const prices = await getEffectivePrices();
    portfolio = applyPortfolioPrices(portfolio, prices);
    const recommendations = calculateAllocation(
      portfolio,
      contribution,
      prices,
      targetAllocations,
    );

    const totalAllocated = recommendations.reduce(
      (sum, r) => sum + r.amount,
      0,
    );
    const summary = `Распределено $${totalAllocated.toFixed(2)} из $${contribution}`;

    // Fetch real-time market data for all ETFs in the portfolio (from Yahoo).
    const portfolioSymbols = Object.keys(portfolio.positions);
    const marketDataResults = await Promise.all(
      portfolioSymbols.map((s) => fetchEtfMarketData(s)),
    );
    const marketData = new Map<string, EtfMarketData>();
    for (const md of marketDataResults) {
      if (md) marketData.set(md.symbol, md);
    }

    // AI объяснение через прямой fetch к Ollama Cloud
    const explanation = await fetchExplanation(
      portfolio,
      contribution,
      recommendations,
      targetAllocations,
      marketData,
    );

    return NextResponse.json({
      explanation,
      toolResults: [
        {
          tool: "calculate_allocation",
          result: {
            recommendations: recommendations.map((rec) => ({
              symbol: rec.symbol,
              amount: rec.amount,
              shares: rec.shares,
              currentWeight: rec.currentWeight,
              targetWeight: rec.target,
              reason: `${rec.symbol}: текущая доля ${(rec.currentWeight * 100).toFixed(1)}%, цель ${(rec.target * 100).toFixed(0)}%`,
            })),
            summary,
          },
        },
      ],
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { explanation: "⚠️ Не удалось получить объяснение от AI" },
      { status: 200 },
    );
  }
}

async function fetchExplanation(
  portfolio: { totalValue: number; positions: Record<string, number> },
  contribution: number,
  recommendations: Array<{
    symbol: string;
    amount: number;
    shares: number;
    currentWeight: number;
    target: number;
  }>,
  targetAllocations: Record<string, number>,
  marketData: Map<string, EtfMarketData>,
): Promise<string> {
  const positionsText = Object.entries(portfolio.positions)
    .map(([s, v]) => `- ${s}: $${Number(v).toLocaleString()}`)
    .join("\n");

  const recsText = recommendations
    .map(
      (r) =>
        `- ${r.symbol}: $${r.amount.toFixed(2)} (${r.shares} акций). Текущая доля ${(r.currentWeight * 100).toFixed(1)}%, цель ${(r.target * 100).toFixed(0)}%`,
    )
    .join("\n");

  // Compute deviations for all ETFs (including those not receiving new money)
  const allDeviations = Object.entries(portfolio.positions)
    .map(([symbol, value]) => {
      const currentWeight =
        portfolio.totalValue > 0 ? value / portfolio.totalValue : 0;
      const target = targetAllocations[symbol] ?? 0;
      const deviation = currentWeight - target;
      const direction =
        deviation > 0.005
          ? "перевес"
          : deviation < -0.005
            ? "недовес"
            : "в цели";
      return {
        symbol,
        value: Number(value),
        currentWeightPct: (currentWeight * 100).toFixed(1),
        targetPct: (target * 100).toFixed(0),
        deviationPct: (deviation * 100).toFixed(1),
        direction,
      };
    })
    .sort(
      (a, b) =>
        Math.abs(Number(b.deviationPct)) - Math.abs(Number(a.deviationPct)),
    );

  const deviationsText = allDeviations
    .map(
      (d) =>
        `- ${d.symbol}: текущая доля ${d.currentWeightPct}%, цель ${d.targetPct}%, отклонение ${d.deviationPct}% (${d.direction})`,
    )
    .join("\n");

  // Build real-time market data section for each ETF in the portfolio.
  const marketDataText = allDeviations
    .map((d) => {
      const md = marketData.get(d.symbol);
      if (!md) {
        return `- ${d.symbol}: рыночные данные недоступны`;
      }
      const trend =
        md.sma7 > md.sma14
          ? "краткосрочно выше SMA14 (бычий сигнал)"
          : "краткосрочно ниже SMA14 (медвежий сигнал)";
      const pricePosition =
        md.currentPrice > md.sma14
          ? "выше SMA14"
          : md.currentPrice > md.sma7
            ? "между SMA7 и SMA14"
            : "ниже SMA7";
      const changeDir =
        md.change30dPct > 0
          ? `📈 +${md.change30dPct.toFixed(1)}%`
          : `📉 ${md.change30dPct.toFixed(1)}%`;
      return [
        `- ${d.symbol}:`,
        `  • Текущая цена: $${md.currentPrice.toFixed(2)}`,
        `  • Изменение за 30д: ${changeDir}`,
        `  • SMA7: $${md.sma7.toFixed(2)} | SMA14: $${md.sma14.toFixed(2)} — ${trend}`,
        `  • Цена ${pricePosition}`,
        `  • Волатильность (годовая): ${(md.volatility * 100).toFixed(1)}%`,
        `  • Диапазон 30д: $${md.low30.toFixed(2)} – $${md.high30.toFixed(2)}`,
      ].join("\n");
    })
    .join("\n\n");

  const prompt = `Ты персональный финансовый аналитик для ETF-портфеля на Interactive Brokers.

## Текущий портфель ($${portfolio.totalValue.toLocaleString()})

${positionsText}

## Целевые доли и отклонения

${deviationsText}

## Рыночные данные (real-time, Yahoo Finance, 30 дней)

${marketDataText}

## Новая сумма для инвестирования: $${contribution}

## Расчётное распределение (алгоритм)

${recsText}

## Задача

Проведи подробный анализ портфеля на основе реальных рыночных данных. Раздели ответ на два раздела:

### 📊 Анализ рынка и отклонений
Разбери каждый ETF. Сопоставь отклонение доли с ценовой динамикой за 30 дней. Объясни причины отклонения — рост/падение цены (используй change30dPct), тренд по SMA (цена выше/ниже SMA7/SMA14), волатильность. Укажи какие ETF перевешивают из-за роста цены (не добавлять), а какие недовешивают из-за падения (приоритет для новых денег на просадке). Используй конкретные цифры из рыночных данных.

### 💡 Рекомендации по стратегии
Объясни логику распределения $${contribution}. Стоит ли покупать на просадках (цена ниже SMA7/SMA14, отрицательное изменение за 30д) или ETF уже растёт. Учти волатильность — высокие значения означают больший риск. Нужно ли продавать перевес (учти налог 12% на прибыль). Конкретные шаги: что купить, в каком порядке, на что обратить внимание по техническим индикаторам. Учти минимальную сделку $50.

Пиши развёрнуто (10-15 предложений всего), конкретно, с цифрами из рыночных данных. Используй эмодзи для наглядности. Без воды.`;

  const response = await callOllamaChat(
    predictionConfig.ollama.explanationModel,
    [
      {
        role: "system",
        content:
          "Ты профессиональный финансовый аналитик для ETF-портфеля. Отвечай подробно, структурированно, с цифрами и эмодзи. Разделяй ответ на разделы с заголовками.",
      },
      { role: "user", content: prompt },
    ],
  );

  return response.trim() || "Не удалось получить анализ";
}
