// src/entities/portfolio/model/parseScreenshotTool.ts
// Parse IB portfolio screenshots via Ollama Cloud vision model

import { z } from "zod";
import { predictionConfig } from "@/shared/lib/predictionConfig";

export const portfolioSchema = z.object({
  totalValue: z.number().describe("Total portfolio value in USD"),
  positions: z
    .record(z.string(), z.number())
    .describe("Map of ETF symbol to market value"),
  prices: z
    .record(z.string(), z.number())
    .describe("Map of ETF symbol to last price per share"),
  shares: z
    .record(z.string(), z.number())
    .describe("Map of ETF symbol to number of shares"),
  costBasis: z
    .record(z.string(), z.number())
    .describe("Map of ETF symbol to cost basis; never use as market value"),
});

export type ParsedPortfolio = Omit<
  z.infer<typeof portfolioSchema>,
  "costBasis"
>;

export async function parseScreenshot(
  imageBase64: string,
): Promise<ParsedPortfolio> {
  const { baseURL, apiKey, visionModel } = predictionConfig.ollama;
  const url = `${baseURL}/api/chat`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: visionModel,
      messages: [
        {
          role: "user",
          content: `Extract portfolio data from this Interactive Brokers screenshot.

Return ONLY a JSON object (no markdown, no code blocks) with:
- totalValue: total portfolio value in USD (number)
- positions: object with ETF symbols as keys and their MARKET VALUES as numbers
- prices: object with ETF symbols as keys and their LAST/CLOSE PRICE per share as numbers
- shares: object with ETF symbols as keys and number of shares as numbers
- costBasis: object with ETF symbols as keys and their COST BASIS values as numbers, only when visible; otherwise {}

For each position, distinguish the columns carefully:
- Use the quantity/position column for shares.
- Use the column labeled Last Price / Последняя цена for prices; never use Average Price, Cost Price, or Cost Basis as the current price.
- Use the column labeled Market Value / Рыночная стоимость for positions; never use Cost Basis / Базовая стоимость as the current market value.
- Do not confuse daily change, percent change, cost basis, or unrealized P&L with these fields.
- Copy displayed values exactly, preserving decimal separators. The costBasis field is separate metadata and must never be copied into positions.
- Check that shares multiplied by last price is close to market value. If your selected market value instead matches costBasis while shares multiplied by last price gives a different value, correct positions to the market value column.

Only include these ETFs: SWRD, EIMI, DPYA, VDTA, LQDA, IDVY, GLDM.
If an ETF is not present, omit it from positions.
Be precise with decimal separators and numbers.

Example response format:
{"totalValue": 16699.07, "positions": {"SWRD": 9968.29, "EIMI": 1154.37}, "prices": {"SWRD": 52.20, "EIMI": 55.00}, "shares": {"SWRD": 191, "EIMI": 21}, "costBasis": {}}`,
          images: [imageBase64],
        },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data.message?.content || "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in vision model response");
  }

  const parsed = portfolioSchema.safeParse(JSON.parse(jsonMatch[0]));
  if (!parsed.success) {
    throw new Error(
      `Invalid portfolio data from vision model: ${parsed.error.message}`,
    );
  }

  const { costBasis, ...portfolio } = parsed.data;
  if (costBasis) {
    for (const [symbol, basis] of Object.entries(costBasis)) {
      const positionValue = portfolio.positions[symbol];
      if (
        positionValue !== undefined &&
        Math.abs(positionValue - basis) <=
          Math.max(0.02, Math.abs(basis) * 0.00001)
      ) {
        throw new Error(
          `Screenshot parsing returned cost basis instead of market value for ${symbol}. Please retry with a clearer screenshot.`,
        );
      }
    }
  }

  for (const [symbol, marketValue] of Object.entries(portfolio.positions)) {
    const shares = portfolio.shares?.[symbol];
    const price = portfolio.prices?.[symbol];
    if (
      shares === undefined ||
      price === undefined ||
      shares <= 0 ||
      price <= 0
    ) {
      throw new Error(
        `Screenshot parsing did not return a valid share count and last price for ${symbol}. Please retry with a clearer screenshot.`,
      );
    }

    const estimatedMarketValue = shares * price;
    if (
      Math.abs(marketValue - estimatedMarketValue) >
      Math.max(5, Math.abs(estimatedMarketValue) * 0.02)
    ) {
      throw new Error(
        `Screenshot parsing returned inconsistent market value and last price for ${symbol}. Please retry with a clearer screenshot.`,
      );
    }
  }

  return portfolio;
}
