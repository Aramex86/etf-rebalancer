// src/features/portfolio-upload/api/parseCsv.ts
// Client wrapper for CSV portfolio parsing API

import type { ParsedPortfolio } from "@/entities/portfolio";

export type { ParsedPortfolio };

export interface CsvParseWarning {
  symbol: string;
  message: string;
}

export interface CsvParseResponse {
  portfolio: ParsedPortfolio;
  warnings: CsvParseWarning[];
  unknownSymbols: string[];
}

/**
 * Send CSV text to the parse-portfolio-csv API endpoint.
 * Returns parsed portfolio data with warnings and unknown symbols.
 */
export async function parsePortfolioCsv(
  csvText: string,
): Promise<CsvParseResponse> {
  const response = await fetch("/api/parse-portfolio-csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csv: csvText }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to parse CSV");
  }

  return response.json();
}
