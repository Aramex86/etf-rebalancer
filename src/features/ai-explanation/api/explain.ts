import { ParsedPortfolio } from "@/entities/portfolio";

export interface ExplainRequest {
  amount: number;
  portfolio?: ParsedPortfolio | null;
}

export async function fetchExplanation({
  amount,
  portfolio,
}: ExplainRequest): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contribution: amount,
      portfolio,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch AI explanation");
  }

  const data = await response.json();
  return data.explanation || "";
}
