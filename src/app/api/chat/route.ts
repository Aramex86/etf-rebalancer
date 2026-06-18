import { NextResponse } from "next/server";
import { getLatestPortfolioSnapshot } from "@/entities/portfolio";
import {
  calculateAllocation,
  getEffectiveTargetAllocations,
  CURRENT_PRICES,
} from "@/entities/etf/model/etfRules";

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
      portfolio = {
        totalValue: 16699.07,
        positions: {
          SWRD: 9968.29,
          EIMI: 1154.37,
          DPYA: 825.17,
          VDTA: 1517.1,
          LQDA: 1550.29,
          IDVY: 206.04,
          GLDM: 1477.81,
        },
      };
    }

    // Расчёт напрямую (без Mastra Tool)
    const targetAllocations = await getEffectiveTargetAllocations();
    const recommendations = calculateAllocation(
      portfolio,
      contribution,
      CURRENT_PRICES,
      targetAllocations,
    );

    const totalAllocated = recommendations.reduce((sum, r) => sum + r.amount, 0);
    const summary = `Распределено $${totalAllocated.toFixed(2)} из $${contribution}`;

    // AI объяснение через прямой fetch к Ollama Cloud
    const explanation = await fetchExplanation(portfolio, contribution, recommendations);

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

  const prompt = `Ты персональный финансовый помощник для ETF-портфеля.

Текущий портфель ($${portfolio.totalValue.toLocaleString()}):
${positionsText}

Новая сумма для инвестирования: $${contribution}

Расчётное распределение:
${recsText}

Объясни простым языком (2-3 предложения) логику распределения. Используй 1-2 эмодзи. Будь кратким.`;

  const response = await fetch("https://api.ollama.com/api/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen3-coder:480b",
      messages: [
        {
          role: "system",
          content:
            "Ты финансовый помощник для ETF-портфеля. Отвечай кратко, понятно, с 1-2 эмодзи.",
        },
        { role: "user", content: prompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  return data.message?.content?.trim() || "Не удалось получить объяснение";
}
