// src/entities/etf/model/allocationTool.ts

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  calculateAllocation,
  CURRENT_PRICES,
  getEffectiveTargetAllocations,
} from "./etfRules";

export const calculateAllocationTool = createTool({
  id: "calculate-allocation",
  description:
    "Рассчитывает оптимальное распределение новой суммы по ETF на основе целевых долей",

  inputSchema: z.object({
    portfolio: z.object({
      totalValue: z.number().describe("Общая стоимость портфеля"),
      positions: z
        .record(z.string(), z.number())
        .describe("Текущие позиции {symbol: marketValue}"),
    }),
    contribution: z.number().describe("Новая сумма для инвестирования"),
  }),

  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        symbol: z.string(),
        amount: z.number(),
        shares: z.number(),
        currentWeight: z.number(),
        targetWeight: z.number(),
        reason: z.string(),
      }),
    ),
    summary: z.string(),
  }),

  execute: async ({ context }) => {
    const { portfolio, contribution } = context;

    const targetAllocations = await getEffectiveTargetAllocations();

    const recommendations = calculateAllocation(
      portfolio,
      contribution,
      CURRENT_PRICES,
      targetAllocations,
    );

    const totalAllocated = recommendations.reduce(
      (sum, r) => sum + r.amount,
      0,
    );
    const summary = `Распределено $${totalAllocated.toFixed(2)} из $${contribution}`;

    return {
      recommendations: recommendations.map((rec) => ({
        symbol: rec.symbol,
        amount: rec.amount,
        shares: rec.shares,
        currentWeight: rec.currentWeight,
        targetWeight: rec.target,
        reason: `${rec.symbol}: текущая доля ${(rec.currentWeight * 100).toFixed(1)}%, цель ${(rec.target * 100).toFixed(0)}%`,
      })),
      summary,
    };
  },
});
