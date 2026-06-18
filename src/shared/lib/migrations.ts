import { query } from "./db";

export async function runMigrations() {
  await query(`
    CREATE TABLE IF NOT EXISTS portfolio_rules (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      target_weight DECIMAL(5,4) NOT NULL,
      price DECIMAL(10,2),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id SERIAL PRIMARY KEY,
      total_value DECIMAL(12,2) NOT NULL,
      positions JSONB NOT NULL,
      prices JSONB,
      shares JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE portfolio_snapshots
    ADD COLUMN IF NOT EXISTS prices JSONB,
    ADD COLUMN IF NOT EXISTS shares JSONB;
  `);
}
