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
    .optional()
    .describe("Map of ETF symbol to price per share"),
  shares: z
    .record(z.string(), z.number())
    .optional()
    .describe("Map of ETF symbol to number of shares"),
});

export type ParsedPortfolio = z.infer<typeof portfolioSchema>;

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
- positions: object with ETF symbols as keys and their market values as numbers
- prices: object with ETF symbols as keys and their price per share as numbers (optional)
- shares: object with ETF symbols as keys and number of shares as numbers (optional)

Only include these ETFs: SWRD, EIMI, DPYA, VDTA, LQDA, IDVY, GLDM.
If an ETF is not present, omit it from positions.
Be precise with numbers.

Example response format:
{"totalValue": 16699.07, "positions": {"SWRD": 9968.29, "EIMI": 1154.37}, "prices": {"SWRD": 52.20, "EIMI": 55.00}, "shares": {"SWRD": 191, "EIMI": 21}}`,
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

  return JSON.parse(jsonMatch[0]);
}
