// src/features/backtest/ui/TradesTable.tsx

"use client";

import { colors, spacing, typography } from "@/shared/ui/tokens";
import { shadows } from "@/shared/ui/tokens/spacing";
import { useIsMobile } from "@/shared/lib/useMediaQuery";
import type { BacktestTradeRecord } from "@/entities/backtest";

interface TradesTableProps {
  trades: BacktestTradeRecord[];
}

const fmtUsd = (v: number) => `$${v.toFixed(2)}`;

/**
 * Table of all trades executed during the backtest.
 * Desktop: full table. Mobile: compact cards.
 */
export function TradesTable({ trades }: TradesTableProps) {
  const isMobile = useIsMobile();

  if (trades.length === 0) {
    return (
      <div
        style={{
          padding: spacing[6],
          textAlign: "center",
          color: colors.neutral[500],
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily.sans.join(", "),
        }}
      >
        📋 Сделок не было — агент не торговал в этом прогоне.
      </div>
    );
  }

  if (isMobile) {
    return (
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}
      >
        {trades.map((t) => {
          const isBuy = t.action === "buy";
          const pnl = t.realizedPnl;
          return (
            <div
              key={t.id}
              style={{
                backgroundColor: colors.neutral[0],
                border: `1px solid ${colors.neutral[200]}`,
                borderLeft: `3px solid ${isBuy ? colors.success[500] : colors.danger[500]}`,
                borderRadius: "0.5rem",
                padding: spacing[3],
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: spacing[1],
                }}
              >
                <span
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.semibold,
                    color: isBuy ? colors.success[600] : colors.danger[600],
                    fontFamily: typography.fontFamily.sans.join(", "),
                  }}
                >
                  {isBuy ? "BUY" : "SELL"} {t.symbol}
                </span>
                <span
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.neutral[400],
                    fontFamily: typography.fontFamily.sans.join(", "),
                  }}
                >
                  W{t.week} · {t.date}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: spacing[1],
                  fontSize: typography.fontSize.xs,
                  color: colors.neutral[600],
                  fontFamily: typography.fontFamily.sans.join(", "),
                }}
              >
                <span>Shares: {t.shares}</span>
                <span>Price: {fmtUsd(t.price)}</span>
                <span>Amount: {fmtUsd(t.amountUsd)}</span>
                <span>Comm: {fmtUsd(t.commission)}</span>
                {pnl !== null && (
                  <span
                    style={{
                      color:
                        pnl >= 0 ? colors.success[600] : colors.danger[600],
                      fontWeight: typography.fontWeight.semibold,
                    }}
                  >
                    P&L: {fmtUsd(pnl)}
                  </span>
                )}
                {t.tax !== null && t.tax > 0 && (
                  <span>Tax: {fmtUsd(t.tax)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop table.
  return (
    <div
      style={{
        backgroundColor: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: "0.5rem",
        overflow: "hidden",
        boxShadow: shadows.sm,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: typography.fontFamily.sans.join(", "),
          fontSize: typography.fontSize.sm,
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: colors.neutral[50],
              borderBottom: `1px solid ${colors.neutral[200]}`,
            }}
          >
            {[
              "Нед.",
              "Дата",
              "Действие",
              "Symbol",
              "Shares",
              "Price",
              "Amount",
              "Comm.",
              "P&L",
              "Налог",
            ].map((h) => (
              <th
                key={h}
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  textAlign: "left",
                  fontSize: typography.fontSize.xs,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.neutral[500],
                  textTransform: "uppercase",
                  letterSpacing: typography.letterSpacing.wide,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const isBuy = t.action === "buy";
            const pnl = t.realizedPnl;
            return (
              <tr
                key={t.id}
                style={{
                  borderBottom: `1px solid ${colors.neutral[100]}`,
                }}
              >
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    color: colors.neutral[500],
                  }}
                >
                  {t.week}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    color: colors.neutral[500],
                  }}
                >
                  {t.date}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    fontWeight: typography.fontWeight.semibold,
                    color: isBuy ? colors.success[600] : colors.danger[600],
                  }}
                >
                  {isBuy ? "BUY" : "SELL"}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    fontWeight: typography.fontWeight.semibold,
                  }}
                >
                  {t.symbol}
                </td>
                <td style={{ padding: `${spacing[2]} ${spacing[3]}` }}>
                  {t.shares}
                </td>
                <td style={{ padding: `${spacing[2]} ${spacing[3]}` }}>
                  {fmtUsd(t.price)}
                </td>
                <td style={{ padding: `${spacing[2]} ${spacing[3]}` }}>
                  {fmtUsd(t.amountUsd)}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    color: colors.neutral[400],
                  }}
                >
                  {fmtUsd(t.commission)}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    color:
                      pnl === null
                        ? colors.neutral[400]
                        : pnl >= 0
                          ? colors.success[600]
                          : colors.danger[600],
                    fontWeight:
                      pnl !== null ? typography.fontWeight.semibold : "normal",
                  }}
                >
                  {pnl === null ? "—" : fmtUsd(pnl)}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    color: colors.neutral[400],
                  }}
                >
                  {t.tax === null || t.tax === 0 ? "—" : fmtUsd(t.tax)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
