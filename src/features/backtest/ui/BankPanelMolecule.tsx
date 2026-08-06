// src/features/backtest/ui/BankPanelMolecule.tsx

"use client";

import { colors, spacing } from "@/shared/ui/tokens";

interface BankPanelMoleculeProps {
  currentCapital: number;
  baseCapital: number;
}

/**
 * "🏦 Банк агента" — cumulative capital panel with P&L.
 * Shown when cumulative mode or live mode is active.
 */
export function BankPanelMolecule({
  currentCapital,
  baseCapital,
}: BankPanelMoleculeProps) {
  const pnlUsd = currentCapital - baseCapital;
  const pnlPct = baseCapital > 0 ? (pnlUsd / baseCapital) * 100 : 0;
  const isProfit = pnlUsd > 0;
  const isLoss = pnlUsd < 0;

  return (
    <div
      style={{
        display: "flex",
        gap: spacing[3],
        flexWrap: "wrap",
        backgroundColor: isProfit
          ? colors.success[50]
          : isLoss
            ? colors.danger[50]
            : colors.neutral[50],
        border: `1px solid ${
          isProfit
            ? colors.success[200]
            : isLoss
              ? colors.danger[200]
              : colors.neutral[200]
        }`,
        borderRadius: "0.5rem",
        padding: `${spacing[3]} ${spacing[4]}`,
        marginBottom: spacing[4],
        fontFamily: typo.fontFamily.sans.join(", "),
      }}
    >
      <div style={{ flex: 1, minWidth: 120 }}>
        <div
          style={{
            fontSize: typo.fontSize.xs,
            color: colors.neutral[500],
            textTransform: "uppercase",
            letterSpacing: typo.letterSpacing.wide,
            marginBottom: spacing[1],
          }}
        >
          🏦 Банк агента
        </div>
        <div
          style={{
            fontSize: typo.fontSize.xl,
            fontWeight: typo.fontWeight.bold,
            color: colors.neutral[900],
          }}
        >
          ${currentCapital.toFixed(2)}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 120 }}>
        <div
          style={{
            fontSize: typo.fontSize.xs,
            color: colors.neutral[500],
            textTransform: "uppercase",
            letterSpacing: typo.letterSpacing.wide,
            marginBottom: spacing[1],
          }}
        >
          Стартовый
        </div>
        <div
          style={{
            fontSize: typo.fontSize.xl,
            fontWeight: typo.fontWeight.semibold,
            color: colors.neutral[600],
          }}
        >
          ${baseCapital.toFixed(2)}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 120 }}>
        <div
          style={{
            fontSize: typo.fontSize.xs,
            color: colors.neutral[500],
            textTransform: "uppercase",
            letterSpacing: typo.letterSpacing.wide,
            marginBottom: spacing[1],
          }}
        >
          {isProfit ? "📈 Прибыль" : isLoss ? "📉 Убыток" : "➖ P&L"}
        </div>
        <div
          style={{
            fontSize: typo.fontSize.xl,
            fontWeight: typo.fontWeight.bold,
            color: isProfit
              ? colors.success[600]
              : isLoss
                ? colors.danger[600]
                : colors.neutral[500],
          }}
        >
          {isProfit ? "+" : ""}${pnlUsd.toFixed(2)}
          <span style={{ fontSize: typo.fontSize.sm }}>
            {" "}
            ({isProfit ? "+" : ""}
            {pnlPct.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
}
