import { ParsedPortfolio } from "@/entities/portfolio";

export type { ParsedPortfolio };

export async function parsePortfolioScreenshot(
  base64Image: string,
): Promise<ParsedPortfolio> {
  const response = await fetch("/api/parse-portfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error || "Failed to parse portfolio screenshot",
    );
  }

  const data = await response.json();
  return data.portfolio;
}
