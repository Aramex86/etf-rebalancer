import { PortfolioRule } from "@/entities/portfolio";

export async function fetchPortfolioRules(): Promise<PortfolioRule[]> {
  const response = await fetch("/api/portfolio-rules");

  if (!response.ok) {
    throw new Error("Failed to fetch portfolio rules");
  }

  const data = await response.json();
  return data.rules as PortfolioRule[];
}

export async function savePortfolioRule(
  rule: PortfolioRule,
): Promise<PortfolioRule[]> {
  const response = await fetch("/api/portfolio-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });

  if (!response.ok) {
    throw new Error("Failed to save portfolio rule");
  }

  const data = await response.json();
  return data.rules as PortfolioRule[];
}

export async function savePortfolioRulesBatch(
  rules: PortfolioRule[],
): Promise<PortfolioRule[]> {
  let latestRules: PortfolioRule[] = [];

  for (const rule of rules) {
    latestRules = await savePortfolioRule(rule);
  }

  return latestRules;
}

export async function initializeDefaultRules(): Promise<{
  message: string;
  rules: Record<string, number>;
}> {
  const response = await fetch("/api/init-rules", { method: "POST" });

  if (!response.ok) {
    throw new Error("Failed to initialize default rules");
  }

  return response.json();
}
