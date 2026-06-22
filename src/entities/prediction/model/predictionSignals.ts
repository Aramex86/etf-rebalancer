// src/entities/prediction/model/predictionSignals.ts

import { predictionConfig } from "@/shared/lib/predictionConfig";
import { colors } from "@/shared/ui/tokens/colors";
import type { Direction, Signal } from "./predictionRepository";

/**
 * Derive a trading signal from direction + after-tax return percentage.
 *
 * - buy:  direction === "up"   AND afterTaxReturnPct >= buyThreshold
 * - sell: direction === "down" AND afterTaxReturnPct <= sellThreshold
 * - hold: everything else
 *
 * Thresholds come from predictionConfig (env-configurable).
 */
export function calcSignal(
  direction: Direction,
  afterTaxReturnPct: number,
): Signal {
  const { buy, sell } = predictionConfig.signalThresholds;

  if (direction === "up" && afterTaxReturnPct >= buy) return "buy";
  if (direction === "down" && afterTaxReturnPct <= sell) return "sell";
  return "hold";
}

/**
 * Map a signal to a design-token colour string.
 * Used by UI molecules for badge styling.
 */
export function getSignalColor(signal: Signal): string {
  switch (signal) {
    case "buy":
      return colors.success[500];
    case "sell":
      return colors.danger[500];
    case "hold":
    default:
      return colors.warning[500];
  }
}

/**
 * Human-readable Russian label for a signal.
 */
export function getSignalLabel(signal: Signal): string {
  switch (signal) {
    case "buy":
      return "Купить";
    case "sell":
      return "Продать";
    case "hold":
    default:
      return "Подождать";
  }
}
