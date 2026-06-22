// src/features/predictions/ui/PredictionCardMolecule.tsx

"use client";

import { BadgeAtom } from "@/shared/atoms/BadgeAtom";
import { CardAtom } from "@/shared/atoms/CardAtom";
import { colors, spacing, typography } from "@/shared/ui/tokens";
import type { PredictionWithAccuracy } from "../api/predictions";
import type { Signal } from "@/entities/prediction";

export interface PredictionCardMoleculeProps {
  prediction: PredictionWithAccuracy;
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

/** Map signal to Russian label. */
function signalLabel(signal: Signal | null): string {
  if (signal === "buy") return "Купить";
  if (signal === "sell") return "Продать";
  if (signal === "hold") return "Подождать";
  return "—";
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

/** Compact label style for grid items. */
const labelStyle: React.CSSProperties = {
  fontSize: typography.fontSize.xs,
  color: colors.neutral[500],
  fontFamily: typography.fontFamily.sans.join(", "),
  marginBottom: spacing[1],
};

/** Compact value style for grid items. */
const valueStyle: React.CSSProperties = {
  fontSize: typography.fontSize.base,
  fontWeight: typography.fontWeight.semibold,
  color: colors.neutral[900],
  fontFamily: typography.fontFamily.sans.join(", "),
};

/**
 * Mobile card view for a single prediction.
 * Compact grid: price / forecast / return / signal.
 * Hides reasoning and category (per plan).
 */
export function PredictionCardMolecule({
  prediction,
}: PredictionCardMoleculeProps) {
  const changePct =
    prediction.currentPrice > 0
      ? ((prediction.predictedPrice - prediction.currentPrice) /
          prediction.currentPrice) *
        100
      : 0;

  let changeColor: string = colors.neutral[600];
  if (changePct > 0) changeColor = colors.success[700];
  else if (changePct < 0) changeColor = colors.danger[700];

  return (
    <CardAtom variant="default" shadow="sm">
      {/* Header: symbol + signal */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing[4],
        }}
      >
        <span
          style={{
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.bold,
            color: colors.neutral[900],
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          {prediction.symbol}
        </span>
        <BadgeAtom variant={signalBadgeVariant(prediction.signal)}>
          {signalLabel(prediction.signal)}
        </BadgeAtom>
      </div>

      {/* Compact 2×2 grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: spacing[4],
        }}
      >
        <div>
          <div style={labelStyle}>Текущая цена</div>
          <div style={valueStyle}>
            {formatPrice(prediction.currentPrice, prediction.currency)}
          </div>
        </div>

        <div>
          <div style={labelStyle}>Прогноз (7д)</div>
          <div style={{ ...valueStyle, color: changeColor }}>
            {formatPrice(prediction.predictedPrice, prediction.currency)}
          </div>
        </div>

        <div>
          <div style={labelStyle}>After-tax доходность</div>
          <div style={valueStyle}>
            {formatPct(prediction.afterTaxReturnPct)}
          </div>
        </div>

        <div>
          <div style={labelStyle}>Изм. %</div>
          <div style={{ ...valueStyle, color: changeColor }}>
            {formatPct(changePct)}
          </div>
        </div>
      </div>

      {/* Alternative hint */}
      {prediction.alternativeSymbol && (
        <div
          style={{
            marginTop: spacing[4],
            paddingTop: spacing[3],
            borderTop: `1px solid ${colors.neutral[100]}`,
            fontSize: typography.fontSize.xs,
            color: colors.neutral[600],
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          💡 Альтернатива: {prediction.alternativeSymbol} (
          {formatPct(prediction.alternativeAfterTaxReturnPct)})
        </div>
      )}
    </CardAtom>
  );
}
