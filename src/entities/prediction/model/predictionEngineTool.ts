// src/entities/prediction/model/predictionEngineTool.ts

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { predict } from "./predictionEngine";
import type { PredictionInput } from "./predictionTypes";
import type { PricePoint } from "@/shared/types/marketData";

/**
 * Mastra tool: run LLM price prediction for a single ETF.
 * Input: { symbol, history, indicators }.
 * Output: { predictedPrice, confidence, direction, reasoning }.
 */
export const predictionEngineTool = createTool({
  id: "predict-price",
  description:
    "Прогнозирует цену ETF через 7 дней с помощью LLM (Ollama). " +
    "Возвращает { predictedPrice, confidence, direction, reasoning }.",

  inputSchema: z.object({
    symbol: z.string().describe("Символ ETF"),
    history: z
      .array(
        z.object({
          date: z.string(),
          close: z.number(),
        }),
      )
      .describe("История цен (минимум 14 точек)"),
    sma7: z.number().describe("7-дневная SMA"),
    sma14: z.number().describe("14-дневная SMA"),
    volatility: z.number().describe("Волатильность за 30 дней"),
    high30: z.number().describe("Максимум за 30 дней"),
    low30: z.number().describe("Минимум за 30 дней"),
  }),

  outputSchema: z.object({
    predictedPrice: z.number(),
    confidence: z.number(),
    direction: z.enum(["up", "down", "flat"]),
    reasoning: z.string(),
  }),

  execute: async ({ context }) => {
    const input: PredictionInput = {
      symbol: context.symbol,
      history: context.history as PricePoint[],
      sma7: context.sma7,
      sma14: context.sma14,
      volatility: context.volatility,
      high30: context.high30,
      low30: context.low30,
    };

    const result = await predict(input);

    return {
      predictedPrice: result.predictedPrice,
      confidence: result.confidence,
      direction: result.direction,
      reasoning: result.reasoning,
    };
  },
});
