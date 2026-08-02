// src/features/backtest/ui/MetricsMolecule.tsx

"use client";

import { colors, spacing, typography } from "@/shared/ui/tokens";
import { shadows } from "@/shared/ui/tokens/spacing";
import { useIsMobile } from "@/shared/lib/useMediaQuery";
import type { BacktestSummary } from "@/entities/backtest";

interface MetricsMoleculeProps {
  summary: BacktestSummary;
}

interface MetricCard {
  label: string;
  value: string;
  color: string;
  hint?: string;
}

/**
 * Grid of summary metrics: return, Sharpe, drawdown, win rate, vs B&H.
 */
export function MetricsMolecule({ summary }: MetricsMoleculeProps) {
  const isMobile = useIsMobile();

  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  const fmtUsd = (v: number) => `$${v.toFixed(2)}`;
  const fmtNum = (v: number) => v.toFixed(2);

  const isProfit = summary.totalReturnPct >= 0;
  const beatsBh = summary.vsBuyHoldDeltaPct >= 0;

  const metrics: MetricCard[] = [
    {
      label: "Доходность",
      value: fmtPct(summary.totalReturnPct),
      color: isProfit ? colors.success[600] : colors.danger[600],
      hint: `${fmtUsd(summary.startValue)} → ${fmtUsd(summary.endValue)}`,
    },
    {
      label: "vs Buy & Hold",
      value: fmtPct(summary.vsBuyHoldDeltaPct),
      color: beatsBh ? colors.success[600] : colors.danger[600],
      hint: `B&H: ${fmtPct(summary.buyHoldReturnPct)}`,
    },
    {
      label: "Sharpe Ratio",
      value: fmtNum(summary.sharpeRatio),
      color:
        summary.sharpeRatio >= 1 ? colors.success[600] : colors.neutral[700],
      hint: "Annualised, rf=0",
    },
    {
      label: "Max Drawdown",
      value: `-${summary.maxDrawdownPct.toFixed(2)}%`,
      color: colors.danger[600],
    },
    {
      label: "Win Rate",
      value: `${(summary.winRate * 100).toFixed(0)}%`,
      color: summary.winRate >= 0.5 ? colors.success[600] : colors.warning[600],
      hint: `${summary.profitableTrades}/${summary.totalTrades} trades`,
    },
    {
      label: "Комиссии + Налоги",
      value: fmtUsd(summary.totalCommission + summary.totalTax),
      color: colors.neutral[600],
      hint: `Comm: ${fmtUsd(summary.totalCommission)}, Tax: ${fmtUsd(summary.totalTax)}`,
    },
  ];

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
    gap: spacing[3],
    width: "100%",
  };

  return (
    <div style={gridStyle}>
      {metrics.map((m) => (
        <div
          key={m.label}
          style={{
            backgroundColor: colors.neutral[0],
            border: `1px solid ${colors.neutral[200]}`,
            borderRadius: "0.5rem",
            padding: spacing[4],
            boxShadow: shadows.sm,
          }}
        >
          <div
            style={{
              fontSize: typography.fontSize.xs,
              color: colors.neutral[500],
              fontFamily: typography.fontFamily.sans.join(", "),
              textTransform: "uppercase",
              letterSpacing: typography.letterSpacing.wide,
              marginBottom: spacing[1],
            }}
          >
            {m.label}
          </div>
          <div
            style={{
              fontSize: typography.fontSize.xl,
              fontWeight: typography.fontWeight.bold,
              color: m.color,
              fontFamily: typography.fontFamily.sans.join(", "),
              lineHeight: typography.lineHeight.tight,
            }}
          >
            {m.value}
          </div>
          {m.hint && (
            <div
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.neutral[400],
                fontFamily: typography.fontFamily.sans.join(", "),
                marginTop: spacing[1],
              }}
            >
              {m.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
