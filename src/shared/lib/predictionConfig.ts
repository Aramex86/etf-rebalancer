// src/shared/lib/predictionConfig.ts

/**
 * Central application configuration.
 *
 * All values are loaded from environment variables with safe defaults,
 * so the app works without explicit config in local dev.
 *
 * This is the single source of truth for:
 * - Ollama Cloud connection + model names
 * - Yahoo Finance API settings
 * - Tax rates (Moldova resident)
 * - Prediction thresholds (signal, flat direction, min history, horizon)
 * - Rebalancing thresholds (min investment, deviation bands)
 * - Alternative ETF comparison threshold
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Signal thresholds in percent after-tax return. */
export interface SignalThresholds {
  /** Buy if direction is up AND afterTaxReturnPct >= buy (default 2.0%) */
  buy: number;
  /** Sell if direction is down AND afterTaxReturnPct <= sell (default -2.0%) */
  sell: number;
}

/** Tax rates applied to predicted returns (Moldova resident). */
export interface TaxConfig {
  /** Moldova capital gains tax on ETF profits (default 0.12 = 12%). */
  capitalGains: number;
  /** UCITS withholding tax on distributing ETF dividends (default 0.15 = 15%). */
  withholding: number;
}

/** Ollama Cloud connection settings. */
export interface OllamaConfig {
  /** Base URL for OpenAI-compatible endpoint (default https://ollama.com). */
  baseURL: string;
  /** API key from OLLAMA_API_KEY env var. */
  apiKey: string;
  /** Model used for price prediction (default minimax-m3:cloud). */
  predictionModel: string;
  /** Model used for allocation explanations (default qwen3-coder:480b). */
  explanationModel: string;
  /** Vision model used for screenshot parsing (default gemma4:31b-cloud). */
  visionModel: string;
}

/** Yahoo Finance API settings. */
export interface YahooConfig {
  /** Base URL for Yahoo Finance chart API. */
  chartURL: string;
  /** User-Agent header for Yahoo Finance requests. */
  userAgent: string;
}

/** Prediction pipeline thresholds. */
export interface PredictionThresholds {
  /** Prediction horizon in days (default 7). */
  horizonDays: number;
  /** History window in days for indicators (default 30). */
  historyDays: number;
  /** Minimum history points required to call the LLM (default 14). */
  minHistoryPoints: number;
  /** Threshold for direction classification: ±1% → "flat". */
  flatThresholdPct: number;
  /** Minimum after-tax return improvement to recommend an alternative ETF (0.5%). */
  minImprovementPct: number;
}

/** Rebalancing thresholds. */
export interface RebalanceThresholds {
  /** Minimum trade amount in USD (default $50). */
  minInvestment: number;
  /** Deviation bands: below `ignore` → ignore, below `consider` → consider, else action. */
  ignore: number;
  consider: number;
  action: number;
}

/** Complete application configuration. */
export interface AppConfig {
  signalThresholds: SignalThresholds;
  tax: TaxConfig;
  ollama: OllamaConfig;
  yahoo: YahooConfig;
  prediction: PredictionThresholds;
  rebalance: RebalanceThresholds;
}

// ---------------------------------------------------------------------------
// Env var helpers
// ---------------------------------------------------------------------------

/**
 * Parse a float env var with a fallback default.
 * Returns default if the env var is missing, empty, or NaN.
 */
function parseFloatEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse an integer env var with a fallback default.
 * Returns default if the env var is missing, empty, or NaN.
 */
function parseIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse a string env var with a fallback default.
 * Returns default if the env var is missing or empty.
 */
function parseStringEnv(name: string, defaultValue: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return raw;
}

// ---------------------------------------------------------------------------
// Singleton config — computed once at module load.
// ---------------------------------------------------------------------------

export const predictionConfig: AppConfig = {
  signalThresholds: {
    buy: parseFloatEnv("SIGNAL_BUY_THRESHOLD_PCT", 2.0),
    sell: parseFloatEnv("SIGNAL_SELL_THRESHOLD_PCT", -2.0),
  },
  tax: {
    capitalGains: parseFloatEnv("MOLDOVA_CAPITAL_GAINS_TAX", 0.12),
    withholding: parseFloatEnv("UCITS_WITHHOLDING_TAX", 0.15),
  },
  ollama: {
    baseURL: parseStringEnv("OLLAMA_BASE_URL", "https://ollama.com"),
    apiKey: parseStringEnv("OLLAMA_API_KEY", ""),
    predictionModel: parseStringEnv("PREDICTION_MODEL", "minimax-m3:cloud"),
    explanationModel: parseStringEnv("EXPLANATION_MODEL", "qwen3-coder:480b"),
    visionModel: parseStringEnv("VISION_MODEL", "gemma4:31b-cloud"),
  },
  yahoo: {
    chartURL: parseStringEnv(
      "YAHOO_FINANCE_CHART_URL",
      "https://query1.finance.yahoo.com/v8/finance/chart",
    ),
    userAgent: parseStringEnv("YAHOO_FINANCE_USER_AGENT", "Mozilla/5.0"),
  },
  prediction: {
    horizonDays: parseIntEnv("PREDICTION_HORIZON_DAYS", 7),
    historyDays: parseIntEnv("PREDICTION_HISTORY_DAYS", 30),
    minHistoryPoints: parseIntEnv("PREDICTION_MIN_HISTORY_POINTS", 14),
    flatThresholdPct: parseFloatEnv("PREDICTION_FLAT_THRESHOLD_PCT", 1),
    minImprovementPct: parseFloatEnv("ALTERNATIVE_MIN_IMPROVEMENT_PCT", 0.5),
  },
  rebalance: {
    minInvestment: parseFloatEnv("REBALANCE_MIN_INVESTMENT", 50),
    ignore: parseFloatEnv("REBALANCE_IGNORE_THRESHOLD", 0.03),
    consider: parseFloatEnv("REBALANCE_CONSIDER_THRESHOLD", 0.05),
    action: parseFloatEnv("REBALANCE_ACTION_THRESHOLD", 0.05),
  },
};

// ---------------------------------------------------------------------------
// Convenience accessors — useful for passing into pure functions
// ---------------------------------------------------------------------------

/** Returns the current signal thresholds. */
export function getSignalThresholds(): SignalThresholds {
  return predictionConfig.signalThresholds;
}

/** Returns the prediction thresholds. */
export function getPredictionThresholds(): PredictionThresholds {
  return predictionConfig.prediction;
}

/** Returns the rebalancing thresholds. */
export function getRebalanceThresholds(): RebalanceThresholds {
  return predictionConfig.rebalance;
}
