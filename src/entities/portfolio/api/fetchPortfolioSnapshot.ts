import type { ParsedPortfolio } from "../model/parseScreenshotTool";

export async function fetchPortfolioSnapshot(): Promise<ParsedPortfolio | null> {
  const response = await fetch("/api/portfolio-snapshot");

  if (!response.ok) {
    throw new Error("Failed to fetch portfolio snapshot");
  }

  const data = await response.json();
  return (data.portfolio as ParsedPortfolio | undefined) ?? null;
}