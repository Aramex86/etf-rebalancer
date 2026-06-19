"use client";

import { ProgressBarAtom } from "@/shared/atoms/ProgressBarAtom";
import { colors, radius, spacing, typography } from "@/shared/ui/tokens";

export interface PortfolioPositionMoleculeProps {
  symbol: string;
  value: number;
  weight: number;
  targetWeight: number;
  newWeight?: number;
  price?: number;
  shares?: number;
}

export const PortfolioPositionMolecule = ({
  symbol,
  value,
  weight,
  targetWeight,
  newWeight,
  price,
  shares,
}: PortfolioPositionMoleculeProps) => {
  const deviation = weight - targetWeight;
  const isOverweight = deviation > 1;
  const isOnTarget = Math.abs(deviation) <= 1;

  const displayWeight = newWeight ?? weight;

  let barColor: string;
  if (isOverweight) {
    barColor = colors.danger[500];
  } else if (isOnTarget) {
    barColor = colors.success[500];
  } else {
    barColor = colors.warning[500];
  }

  return (
    <div
      style={{
        padding: spacing[3],
        marginBottom: spacing[2],
        backgroundColor: colors.neutral[50],
        borderRadius: radius.md,
        border: `1px solid ${colors.neutral[200]}`,
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
            color: colors.neutral[900],
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          {symbol}
        </span>
        <span
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.neutral[600],
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          ${value.toLocaleString()}
        </span>
      </div>

      {/* Excel-style row: shares | price | value */}
      {(shares !== undefined || price !== undefined) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: spacing[2],
            marginBottom: spacing[2],
            padding: `${spacing[1]} ${spacing[2]}`,
            backgroundColor: colors.neutral[100],
            borderRadius: radius.sm,
            fontSize: typography.fontSize.xs,
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: colors.neutral[500], fontSize: "10px" }}>
              Кол-во
            </div>
            <div
              style={{
                fontWeight: typography.fontWeight.semibold,
                color: colors.neutral[800],
              }}
            >
              {shares !== undefined ? shares.toLocaleString() : "—"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: colors.neutral[500], fontSize: "10px" }}>
              Цена
            </div>
            <div
              style={{
                fontWeight: typography.fontWeight.semibold,
                color: colors.neutral[800],
              }}
            >
              {price !== undefined ? `$${price.toFixed(2)}` : "—"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: colors.neutral[500], fontSize: "10px" }}>
              Сумма
            </div>
            <div
              style={{
                fontWeight: typography.fontWeight.semibold,
                color: colors.neutral[800],
              }}
            >
              ${value.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <ProgressBarAtom
        value={displayWeight}
        max={Math.max(targetWeight * 1.5, displayWeight)}
        color={barColor}
        backgroundColor={colors.neutral[200]}
        height="6px"
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: spacing[1],
          fontFamily: typography.fontFamily.sans.join(", "),
        }}
      >
        <span
          style={{
            color: colors.neutral[900],
            fontSize: typography.fontSize.sm,
          }}
        >
          {weight.toFixed(1)}%
          {newWeight !== undefined && (
            <span
              style={{
                color: colors.brand[600],
                fontWeight: typography.fontWeight.medium,
              }}
            >
              {" "}
              → {newWeight.toFixed(1)}%
            </span>
          )}
        </span>
        <span
          style={{
            color: colors.neutral[900],
            fontSize: typography.fontSize.sm,
          }}
        >
          Цель {targetWeight.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};
