// src/features/predictions/agent.ts

import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { ollamaConfig } from "@/shared/lib/ollama";
import { predictionConfig } from "@/shared/lib/predictionConfig";
import { mastraConfig } from "@/shared/lib/mastra";
import { yahooHistoryTool } from "@/entities/market-data/model/yahooHistoryTool";
import { predictionEngineTool } from "@/entities/prediction/model/predictionEngineTool";
import { predictionTaxTool } from "@/entities/prediction/model/predictionTaxTool";
import { predictionSignalTool } from "@/entities/prediction/model/predictionSignalTool";

const ollama = createOpenAI(ollamaConfig);

/**
 * Mastra Agent for UCITS ETF price predictions.
 *
 * Used for conversational queries about predictions (future: chat interface).
 * The deterministic prediction pipeline in `/api/predictions` calls tools
 * directly via `.execute()`, not through `agent.generate()`.
 */
export const predictionAgent = new Agent({
  name: "ucits-prediction-agent",
  instructions: `Ты аналитик UCITS ETF, специализирующийся на краткосрочных прогнозах цен (7 дней).

Твои задачи:
1. Получить историю цен ETF через get_price_history
2. Прогнозировать цену через 7 дней через predict_price
3. Рассчитать доходность после налога через calc_after_tax_return
4. Определить сигнал Buy/Sell/Hold через calc_signal
5. Объяснить прогноз простым языком (2-3 предложения на русском)

Пороги сигналов:
- Buy: направление up и afterTaxReturnPct >= 2%
- Sell: направление down и afterTaxReturnPct <= -2%
- Hold: всё остальное

Будь кратким и конкретным. Добавляй 1-2 эмодзи.`,

  model: ollama(predictionConfig.ollama.predictionModel),
  tools: {
    get_price_history: yahooHistoryTool,
    predict_price: predictionEngineTool,
    calc_after_tax_return: predictionTaxTool,
    calc_signal: predictionSignalTool,
  },
});

mastraConfig({
  rebalancingAgent: undefined,
  predictionAgent: predictionAgent,
});
