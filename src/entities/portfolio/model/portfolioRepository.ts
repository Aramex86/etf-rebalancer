import { query } from "@/shared/lib/db";

export interface PortfolioRule {
  symbol: string;
  name: string;
  targetWeight: number;
  price: number | null;
}

export async function getPortfolioRules(): Promise<PortfolioRule[]> {
  const result = await query(
    "SELECT symbol, name, target_weight, price FROM portfolio_rules ORDER BY symbol",
  );

  return result.rows.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    targetWeight: Number(row.target_weight),
    price: row.price ? Number(row.price) : null,
  }));
}

export async function getTargetAllocations(): Promise<Record<string, number>> {
  const rules = await getPortfolioRules();

  if (rules.length === 0) {
    return {};
  }

  return Object.fromEntries(
    rules.map((rule) => [rule.symbol, rule.targetWeight]),
  );
}

/**
 * Get prices for all ETFs from portfolio_rules.
 * Only includes rules where price is not null.
 */
export async function getRulePrices(): Promise<Record<string, number>> {
  const rules = await getPortfolioRules();
  const prices: Record<string, number> = {};
  for (const rule of rules) {
    if (rule.price !== null && rule.price > 0) {
      prices[rule.symbol] = rule.price;
    }
  }
  return prices;
}

/**
 * Get prices from the latest portfolio snapshot.
 * Falls back to rule prices if snapshot has no prices.
 */
export async function getLatestSnapshotPrices(): Promise<
  Record<string, number>
> {
  const snapshot = await getLatestPortfolioSnapshot();
  if (snapshot && Object.keys(snapshot.prices).length > 0) {
    return snapshot.prices;
  }
  return getRulePrices();
}

export async function savePortfolioRule(rule: PortfolioRule): Promise<void> {
  await query(
    `INSERT INTO portfolio_rules (symbol, name, target_weight, price, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (symbol) DO UPDATE SET
       name = EXCLUDED.name,
       target_weight = EXCLUDED.target_weight,
       price = EXCLUDED.price,
       updated_at = NOW()`,
    [rule.symbol, rule.name, rule.targetWeight, rule.price],
  );
}

export async function deletePortfolioRule(symbol: string): Promise<void> {
  await query("DELETE FROM portfolio_rules WHERE symbol = $1", [symbol]);
}

export async function updatePortfolioRulePrices(
  prices: Record<string, number>,
): Promise<void> {
  for (const [symbol, price] of Object.entries(prices)) {
    await query(
      `UPDATE portfolio_rules
       SET price = $1, updated_at = NOW()
       WHERE symbol = $2`,
      [price, symbol],
    );
  }
}

export interface PortfolioSnapshot {
  id: number;
  totalValue: number;
  positions: Record<string, number>;
  prices: Record<string, number>;
  shares: Record<string, number>;
  createdAt: Date;
}

export async function savePortfolioSnapshot(
  totalValue: number,
  positions: Record<string, number>,
  prices?: Record<string, number>,
  shares?: Record<string, number>,
): Promise<number> {
  const result = await query(
    `INSERT INTO portfolio_snapshots (total_value, positions, prices, shares, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id`,
    [
      totalValue,
      JSON.stringify(positions),
      prices ? JSON.stringify(prices) : null,
      shares ? JSON.stringify(shares) : null,
    ],
  );
  return result.rows[0].id;
}

export async function getLatestPortfolioSnapshot(): Promise<PortfolioSnapshot | null> {
  const result = await query(
    `SELECT id, total_value, positions, prices, shares, created_at 
     FROM portfolio_snapshots 
     ORDER BY created_at DESC 
     LIMIT 1`,
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    totalValue: Number(row.total_value),
    positions: row.positions,
    prices: row.prices || {},
    shares: row.shares || {},
    createdAt: new Date(row.created_at),
  };
}
