// src/features/predictions/ui/PredictionTableMolecule.tsx

"use client";

import { useState } from "react";
import { BadgeAtom } from "@/shared/atoms/BadgeAtom";
import { colors, spacing, typography } from "@/shared/ui/tokens";
import type { PredictionWithAccuracy } from "../api/predictions";
import type { Signal } from "@/entities/prediction";

type SortKey = "afterTaxReturnPct" | "accuracy";
type SortDir = "asc" | "desc";

export interface PredictionTableMoleculeProps {
  predictions: PredictionWithAccuracy[];
}

/** Map signal to BadgeAtom variant. */
function signalBadgeVariant(
  signal: Signal | null,
): "success" | "danger" | "warning" | "neutral" {
  if (signal === "buy") return "success";
  if (signal === "sell") return "danger";
  if (signal === "hold") return "warning";
  return "neutral";
}

/** Render sort arrow indicator for the active column. */
function sortArrow(key: SortKey, activeKey: SortKey, dir: SortDir): string {
  if (key !== activeKey) return "";
  return dir === "desc" ? "↓" : "↑";
}

/** Map signal to Russian label. */
function signalLabel(signal: Signal | null): string {
  if (signal === "buy") return "Купить";
  if (signal === "sell") return "Продать";
  if (signal === "hold") return "Подождать";
  return "—";
}

/** Accuracy color: green > 60%, yellow 50-60%, red < 50%. */
function accuracyColor(accuracy: number): string {
  if (accuracy >= 0.6) return colors.success[700];
  if (accuracy >= 0.5) return colors.warning[700];
  return colors.danger[700];
}

/** Format a number as currency. */
function formatPrice(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  let symbol = "";
  if (currency === "USD") symbol = "$";
  else if (currency === "EUR") symbol = "€";
  return `${symbol}${value.toFixed(2)}`;
}

/** Format a percentage value. */
function formatPct(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Desktop table view of predictions.
 * Columns: Symbol | Current | Predicted | Change% | After-tax% | Signal | Confidence | Accuracy | Reasoning
 */
export function PredictionTableMolecule({
  predictions,
}: PredictionTableMoleculeProps) {
  const [sortKey, setSortKey] = useState<SortKey>("afterTaxReturnPct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...predictions].sort((a, b) => {
    const dir = sortDir === "desc" ? -1 : 1;
    if (sortKey === "accuracy") {
      // Treat 0 (no data) as -1 so it always sorts last regardless of direction.
      const av = a.accuracy > 0 ? a.accuracy : -1;
      const bv = b.accuracy > 0 ? b.accuracy : -1;
      return (av - bv) * dir;
    }
    const av = a.afterTaxReturnPct ?? -Infinity;
    const bv = b.afterTaxReturnPct ?? -Infinity;
    return (av - bv) * dir;
  });

  const thStyle: React.CSSProperties = {
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[600],
    textAlign: "left",
    borderBottom: `2px solid ${colors.neutral[200]}`,
    fontFamily: typography.fontFamily.sans.join(", "),
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    color: colors.neutral[800],
    borderBottom: `1px solid ${colors.neutral[100]}`,
    fontFamily: typography.fontFamily.sans.join(", "),
    verticalAlign: "top",
  };

  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: "0.5rem",
        border: `1px solid ${colors.neutral[200]}`,
        backgroundColor: colors.neutral[0],
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: typography.fontSize.sm,
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>Символ</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Текущая цена</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Прогноз (7д)</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Изм. %</th>
            <th
              style={{ ...thStyle, textAlign: "right" }}
              onClick={() => handleSort("afterTaxReturnPct")}
            >
              After-tax % {sortArrow("afterTaxReturnPct", sortKey, sortDir)}
            </th>
            <th style={thStyle}>Сигнал</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Confidence</th>
            <th
              style={{ ...thStyle, textAlign: "right" }}
              onClick={() => handleSort("accuracy")}
            >
              Точность {sortArrow("accuracy", sortKey, sortDir)}
            </th>
            <th style={thStyle}>Обоснование</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pred) => {
            const changePct =
              pred.currentPrice > 0
                ? ((pred.predictedPrice - pred.currentPrice) /
                    pred.currentPrice) *
                  100
                : 0;
            let changeColor: string = colors.neutral[600];
            if (changePct > 0) changeColor = colors.success[700];
            else if (changePct < 0) changeColor = colors.danger[700];

            return (
              <tr key={pred.id}>
                <td
                  style={{
                    ...tdStyle,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.neutral[900],
                  }}
                >
                  {pred.symbol}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {formatPrice(pred.currentPrice, pred.currency)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {formatPrice(pred.predictedPrice, pred.currency)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    color: changeColor,
                    fontWeight: typography.fontWeight.semibold,
                  }}
                >
                  {formatPct(changePct)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontWeight: typography.fontWeight.semibold,
                  }}
                >
                  {formatPct(pred.afterTaxReturnPct)}
                </td>
                <td style={tdStyle}>
                  <BadgeAtom variant={signalBadgeVariant(pred.signal)}>
                    {signalLabel(pred.signal)}
                  </BadgeAtom>
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {pred.confidence !== null
                    ? `${(pred.confidence * 100).toFixed(0)}%`
                    : "—"}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    color: accuracyColor(pred.accuracy),
                    fontWeight: typography.fontWeight.semibold,
                  }}
                >
                  {pred.accuracy > 0
                    ? `${(pred.accuracy * 100).toFixed(0)}%`
                    : "—"}
                </td>
                <td style={{ ...tdStyle, maxWidth: "300px" }}>
                  {pred.reasoning ? (
                    <details>
                      <summary
                        style={{
                          cursor: "pointer",
                          color: colors.brand[600],
                          fontSize: typography.fontSize.xs,
                        }}
                      >
                        Показать
                      </summary>
                      <div
                        style={{
                          marginTop: spacing[2],
                          fontSize: typography.fontSize.xs,
                          color: colors.neutral[600],
                          lineHeight: typography.lineHeight.normal,
                        }}
                      >
                        {pred.reasoning}
                      </div>
                    </details>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
