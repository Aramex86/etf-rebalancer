// src/entities/backtest/model/swingAgentPrompt.ts

import type { AgentContext, AgentResponse, AgentAction } from "./backtestTypes";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for the swing trading agent.
 * This defines the agent's role, rules, and output format.
 */
export function buildSystemPrompt(): string {
  return `You are a swing trading agent managing a UCITS ETF portfolio.
Your goal: buy low, sell high, generate profit from price swings over 1-2 week horizons.

You receive current market state every week and decide actions for the next week.

Rules:
- Max 3 concurrent positions at any time.
- Max 50% of available cash into one position.
- Minimum trade size: $50.
- Account for commissions ($1 minimum + 0.05% spread) and tax (12% on realized profit).
- Prefer ETFs with high volatility and clear trends (RSI < 30 = oversold = buy signal, RSI > 70 = overbought = sell signal).
- Use SMA crossover: SMA7 > SMA14 = uptrend, SMA7 < SMA14 = downtrend.
- Hold cash when no clear opportunity — do not force trades.
- You can only sell shares you already own.
- You can buy with available cash only.

Return ONLY a valid JSON object with this exact structure:
{
  "actions": [
    { "symbol": "GLDM", "action": "buy", "amountUsd": 300 },
    { "symbol": "SWRD", "action": "sell", "shares": 5 },
    { "symbol": "EIMI", "action": "hold" }
  ],
  "reasoning": "short explanation of your decisions"
}

Rules for actions:
- "buy": include "amountUsd" (how much money to invest in USD).
- "sell": include "shares" (how many shares to sell).
- "hold": no additional fields needed.
- Only include ETFs you want to act on. Omit ETFs you want to hold (no action).
- "reasoning" must be a single string, not an array.`;
}

// ---------------------------------------------------------------------------
// User prompt
// ---------------------------------------------------------------------------

/**
 * Build the user prompt with current market data + portfolio state.
 * @param context Full agent context for the current step.
 * @returns Formatted prompt string.
 */
export function buildUserPrompt(context: AgentContext): string {
  const { week, totalWeeks, date, markets, portfolio, recentTrades } = context;

  // Market data table
  const marketLines = markets
    .map((m) => {
      return `${m.symbol.padEnd(6)}  $${m.currentPrice.toFixed(2).padStart(8)}  ${m.sma7.toFixed(2).padStart(8)}  ${m.sma14.toFixed(2).padStart(8)}  ${m.rsi14.toFixed(1).padStart(5)}  ${(m.volatility * 100).toFixed(1).padStart(5)}%  $${m.high30.toFixed(2).padStart(8)}  $${m.low30.toFixed(2).padStart(8)}`;
    })
    .join("\n");

  // Portfolio positions
  const positionLines = portfolio.positions
    .map((p) => {
      const pnlSign = p.unrealizedPnl >= 0 ? "+" : "";
      return `  ${p.symbol.padEnd(6)}  ${String(p.shares).padStart(4)} shares @ $${p.avgPrice.toFixed(2)}  →  market $${p.marketValue.toFixed(2)}  unrealized P&L: ${pnlSign}$${p.unrealizedPnl.toFixed(2)}`;
    })
    .join("\n");

  // Recent trades
  const tradeLines = recentTrades
    .map((t) => {
      let pnlStr = "";
      if (t.realizedPnl !== null) {
        const sign = t.realizedPnl >= 0 ? "+" : "";
        pnlStr = ` (P&L: ${sign}$${t.realizedPnl.toFixed(2)})`;
      }
      return `  Week ${String(t.week).padStart(3)}  ${t.action.toUpperCase().padEnd(4)}  ${t.symbol.padEnd(6)}  ${String(t.shares).padStart(4)} shares @ $${t.price.toFixed(2)}${pnlStr}`;
    })
    .join("\n");

  return `Week ${week} of ${totalWeeks} | Date: ${date}

=== Market Data ===
Symbol  Price        SMA7      SMA14     RSI    Vol    High30      Low30
${marketLines}

=== Portfolio ===
Cash: $${portfolio.cash.toFixed(2)}
Positions (${portfolio.positions.length}/3):
${positionLines || "  (no positions)"}

Total portfolio value: $${portfolio.totalValue.toFixed(2)}

=== Recent Trades (last 4 weeks) ===
${tradeLines || "  (no recent trades)"}

Decide your actions for this week. Return ONLY a JSON object.`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

/**
 * Extract the first JSON object from a text string.
 * Handles cases where the LLM wraps JSON in markdown code fences.
 */
function extractJson(text: string): string | null {
  // Try direct parse first.
  try {
    JSON.parse(text);
    return text;
  } catch {
    // Continue to regex extraction.
  }

  // Extract first {...} block by finding matching braces.
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) return null;
  const lastBrace = text.lastIndexOf("}");
  if (lastBrace <= firstBrace) return null;

  const jsonStr = text.slice(firstBrace, lastBrace + 1);
  try {
    JSON.parse(jsonStr);
    return jsonStr;
  } catch {
    return null;
  }
}

/**
 * Validate a single action item from the LLM response.
 */
function validateActionItem(item: unknown): AgentAction | null {
  if (typeof item !== "object" || item === null) return null;

  const a = item as Record<string, unknown>;
  const symbol = a.symbol;
  const action = a.action;

  if (typeof symbol !== "string" || typeof action !== "string") return null;
  if (action !== "buy" && action !== "sell" && action !== "hold") return null;

  const validated: AgentAction = {
    symbol,
    action: action as AgentAction["action"],
  };

  if (action === "buy") {
    const amountUsd = Number(a.amountUsd);
    if (Number.isFinite(amountUsd) && amountUsd > 0) {
      validated.amountUsd = amountUsd;
    }
  } else if (action === "sell") {
    const shares = Number(a.shares);
    if (Number.isFinite(shares) && shares > 0) {
      validated.shares = Math.floor(shares);
    }
  }

  return validated;
}

/**
 * Parse and validate the LLM response into an AgentResponse.
 * @param rawText Raw text response from the LLM.
 * @returns Parsed AgentResponse, or null if invalid.
 */
export function parseAgentResponse(rawText: string): AgentResponse | null {
  const jsonStr = extractJson(rawText);
  if (!jsonStr) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  // Validate actions array.
  const actionsRaw = obj.actions;
  if (!Array.isArray(actionsRaw)) return null;

  const actions: AgentAction[] = [];
  for (const item of actionsRaw) {
    const validated = validateActionItem(item);
    if (validated) {
      actions.push(validated);
    }
  }

  const reasoning = obj.reasoning;
  if (typeof reasoning !== "string") {
    return { actions, reasoning: "" };
  }

  return { actions, reasoning };
}
