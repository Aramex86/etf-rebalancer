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

  // ── Prediction Agent tables ──────────────────────────────────────────────

  await query(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL UNIQUE,
      yahoo_symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'equity',
      currency TEXT NOT NULL DEFAULT 'USD',
      dist_policy TEXT NOT NULL DEFAULT 'acc' CHECK (dist_policy IN ('acc','dist')),
      alternatives TEXT[] DEFAULT '{}',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      date DATE NOT NULL,
      close DECIMAL(12,4) NOT NULL,
      UNIQUE(symbol, date)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_price_history_symbol_date
    ON price_history (symbol, date DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS predictions (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      target_date DATE NOT NULL,
      horizon_days INTEGER NOT NULL DEFAULT 7,
      currency TEXT,
      current_price DECIMAL(12,4) NOT NULL,
      predicted_price DECIMAL(12,4) NOT NULL,
      confidence DECIMAL(5,4),
      direction TEXT NOT NULL CHECK (direction IN ('up','down','flat')),
      reasoning TEXT,
      after_tax_return_pct DECIMAL(8,4),
      signal TEXT CHECK (signal IN ('buy','sell','hold')),
      alternative_symbol TEXT,
      alternative_after_tax_return_pct DECIMAL(8,4),
      baseline_predicted_price DECIMAL(12,4),
      baseline_direction TEXT CHECK (baseline_direction IN ('up','down','flat')),
      actual_price DECIMAL(12,4),
      actual_direction TEXT CHECK (actual_direction IN ('up','down','flat')),
      direction_correct BOOLEAN,
      error_pct DECIMAL(8,4),
      mape DECIMAL(8,4),
      verified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_predictions_symbol_created
    ON predictions (symbol, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_predictions_unverified
    ON predictions (target_date)
    WHERE verified_at IS NULL;
  `);

  // ── Backtest Swing Simulator tables ───────────────────────────────────────

  await query(`
    CREATE TABLE IF NOT EXISTS backtest_runs (
      id SERIAL PRIMARY KEY,
      run_id TEXT NOT NULL UNIQUE,
      model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','paused','done','failed')),
      params JSONB NOT NULL,
      start_value DECIMAL(12,2) NOT NULL,
      end_value DECIMAL(12,2),
      total_return_pct DECIMAL(8,4),
      buy_hold_return_pct DECIMAL(8,4),
      sharpe_ratio DECIMAL(6,4),
      max_drawdown_pct DECIMAL(8,4),
      win_rate DECIMAL(4,3),
      total_trades INTEGER DEFAULT 0,
      profitable_trades INTEGER DEFAULT 0,
      total_commission DECIMAL(10,2) DEFAULT 0,
      total_tax DECIMAL(10,2) DEFAULT 0,
      current_week INTEGER DEFAULT 0,
      total_weeks INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_backtest_runs_created
    ON backtest_runs (created_at DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS backtest_trades (
      id SERIAL PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES backtest_runs(run_id),
      week INTEGER NOT NULL,
      date DATE NOT NULL,
      symbol TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('buy','sell')),
      shares INTEGER NOT NULL,
      price DECIMAL(10,4) NOT NULL,
      amount_usd DECIMAL(12,2) NOT NULL,
      commission DECIMAL(10,2) NOT NULL DEFAULT 0,
      tax DECIMAL(10,2),
      realized_pnl DECIMAL(12,2),
      cash_after DECIMAL(12,2) NOT NULL
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_backtest_trades_run_week
    ON backtest_trades (run_id, week);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS backtest_snapshots (
      id SERIAL PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES backtest_runs(run_id),
      week INTEGER NOT NULL,
      date DATE NOT NULL,
      cash DECIMAL(12,2) NOT NULL,
      positions JSONB NOT NULL,
      total_value DECIMAL(12,2) NOT NULL,
      UNIQUE(run_id, week)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_backtest_snapshots_run_week
    ON backtest_snapshots (run_id, week);
  `);
}
