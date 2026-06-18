// src/features/calculate-allocation/agent.ts

import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { calculateAllocationTool } from "@/entities/etf/model/allocationTool";
import { ollamaConfig } from "@/shared/lib/ollama";
import { mastraConfig } from "@/shared/lib/mastra";

const ollama = createOpenAI(ollamaConfig);

export const rebalancingAgent = new Agent({
  name: "etf-rebalancing-agent",
  instructions: `Ты персональный финансовый помощник для ETF-портфеля.

Твоя задача:
1. Получить данные о портфеле и новой сумме инвестирования
2. Вызвать инструмент calculate_allocation для расчёта оптимального распределения
3. Объяснить логику простым языком (2-3 предложения)
4. Использовать 1-2 эмодзи для наглядности

Будь кратким и конкретным.`,

  model: ollama("qwen3-coder:480b"),
  tools: {
    calculate_allocation: calculateAllocationTool,
  },
});

mastraConfig({
  rebalancingAgent: rebalancingAgent,
});
