import { NextResponse } from "next/server";
import { getLatestPortfolioSnapshot } from "@/entities/portfolio";
import {
  calculateAllocation,
  getEffectiveTargetAllocations,
  getEffectivePrices,
  CURRENT_PORTFOLIO,
} from "@/entities/etf";
import { predictionConfig } from "@/shared/lib/predictionConfig";
import { callOllamaChat } from "@/shared/lib/ollama";

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
        };
      }
    }
    if (!portfolio) {
      portfolio = CURRENT_PORTFOLIO;
    }

    // Расчёт напрямую (без Mastra Tool)
    const targetAllocations = await getEffectiveTargetAllocations();
    const prices = await getEffectivePrices();
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

    // AI объяснение через прямой fetch к Ollama Cloud
    const explanation = await fetchExplanation(
      portfolio,
      contribution,
      recommendations,
      targetAllocations,
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

  const prompt = `Ты персональный финансовый аналитик для ETF-портфеля на Interactive Brokers.

## Текущий портфель ($${portfolio.totalValue.toLocaleString()})

${positionsText}

## Целевые доли и отклонения

${deviationsText}

## Новая сумма для инвестирования: $${contribution}

## Расчётное распределение (алгоритм)

${recsText}

## Задача

Проведи подробный анализ портфеля. Раздели ответ на два раздела:

### 📊 Анализ отклонений
Разбери каждый ETF с значимым отклонением (>1% от цели). Объясни возможные причины отклонения — рост/падение цены, новые пополнения, отсутствие покупок. Укажи какие ETF перевешивают (нужно осторожно добавлять или не добавлять) и какие недовешивают (приоритет для новых денег). Используй конкретные цифры из данных выше.

### 💡 Рекомендации по стратегии
Объясни логику распределения $${contribution}. Почему деньги идут именно в эти ETF. Стоит ли покупать на просадках или ждать. Нужно ли продавать перевес (учти налоговую эффективность — продажи облагаются налогом 12%). Конкретные шаги: что купить, в каком порядке, на что обратить внимание. Учти минимальную сделку $50.

Пиши развёрнуто (10-15 предложений всего), конкретно, с цифрами. Используй эмодзи для наглядности. Без воды.`;

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
