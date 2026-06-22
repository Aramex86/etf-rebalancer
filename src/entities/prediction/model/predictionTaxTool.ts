// src/entities/prediction/model/predictionTaxTool.ts

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { calcAfterTaxReturn } from "./predictionTax";

/**
 * Mastra tool: calculate after-tax return for a Moldova resident.
 * Input: { currentPrice, predictedPrice, distPolicy, currency }.
 * Output: { grossReturn, afterTaxReturn, afterTaxReturnPct, warning }.
 */
export const predictionTaxTool = createTool({
  id: "calc-after-tax-return",
  description:
    "Рассчитывает доходность после налога для резидента Молдовы " +
    "(12% налог на прирост капитала, 15% withholding для dist ETF).",

  inputSchema: z.object({
    currentPrice: z.number().describe("Текущая цена"),
    predictedPrice: z.number().describe("Прогнозируемая цена через 7 дней"),
    distPolicy: z
      .enum(["acc", "dist"])
      .describe(
        "Политика распределения: acc (накопительный) или dist (выплачивающий)",
      ),
    currency: z.string().describe("Валюта ETF").default("USD"),
  }),

  outputSchema: z.object({
    grossReturn: z.number(),
    afterTaxReturn: z.number(),
    afterTaxReturnPct: z.number(),
    warning: z.string().nullable(),
  }),

  execute: async ({ context }) => {
    const result = calcAfterTaxReturn(
      context.currentPrice,
      context.predictedPrice,
      context.distPolicy,
      context.currency,
    );

    return {
      grossReturn: result.grossReturn,
      afterTaxReturn: result.afterTaxReturn,
      afterTaxReturnPct: result.afterTaxReturnPct,
      warning: result.warning,
    };
  },
});
