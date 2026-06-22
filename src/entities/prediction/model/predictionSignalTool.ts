// src/entities/prediction/model/predictionSignalTool.ts

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  calcSignal,
  getSignalColor,
  getSignalLabel,
} from "./predictionSignals";

/**
 * Mastra tool: derive a Buy/Sell/Hold signal from direction + after-tax return.
 * Input: { direction, afterTaxReturnPct }.
 * Output: { signal, color, label }.
 */
export const predictionSignalTool = createTool({
  id: "calc-signal",
  description:
    "Определяет сигнал Buy/Sell/Hold на основе направления прогноза " +
    "и доходности после налога.",

  inputSchema: z.object({
    direction: z.enum(["up", "down", "flat"]).describe("Направление прогноза"),
    afterTaxReturnPct: z
      .number()
      .describe("Доходность после налога в процентах"),
  }),

  outputSchema: z.object({
    signal: z.enum(["buy", "sell", "hold"]),
    color: z.string(),
    label: z.string(),
  }),

  execute: async ({ context }) => {
    const signal = calcSignal(context.direction, context.afterTaxReturnPct);

    return {
      signal,
      color: getSignalColor(signal),
      label: getSignalLabel(signal),
    };
  },
});
