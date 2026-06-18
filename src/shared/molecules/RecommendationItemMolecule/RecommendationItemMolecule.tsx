"use client";

import { BadgeAtom } from "@/shared/atoms/BadgeAtom";
import { ProgressBarAtom } from "@/shared/atoms/ProgressBarAtom";
import { colors, radius, spacing, typography } from "@/shared/ui/tokens";

export interface RecommendationItemMoleculeProps {
  symbol: string;
  currentWeight: number;
  target: number;
  amount: number;
  shares: number;
  newWeight: number;
}

export const RecommendationItemMolecule = ({
  symbol,
  currentWeight,
  target,
  amount,
  shares,
  newWeight,
}: RecommendationItemMoleculeProps) => {
  const deviation = currentWeight - target;
  const isUnderweight = deviation < -0.01;
  const isOverweight = deviation > 0.01;

  return (
    <div
      style={{
        padding: spacing[4],
        marginBottom: spacing[3],
        backgroundColor: colors.neutral[0],
        borderRadius: radius.md,
        border: `1px solid ${colors.neutral[200]}`,
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
          <span
            style={{
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.bold,
              color: colors.neutral[900],
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            {symbol}
          </span>
          {isUnderweight && <BadgeAtom variant="warning">Недодан</BadgeAtom>}
          {isOverweight && <BadgeAtom variant="danger">Передан</BadgeAtom>}
          {!isUnderweight && !isOverweight && (
            <BadgeAtom variant="neutral">В цели</BadgeAtom>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.bold,
              color: colors.success[600],
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            ${amount.toFixed(2)}
          </div>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.neutral[500],
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            {shares} акций
          </div>
        </div>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: spacing[2],
            fontSize: typography.fontSize.sm,
            color: colors.neutral[600],
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          <span>
            Сейчас {(currentWeight * 100).toFixed(1)}% → Будет{" "}
            {(newWeight * 100).toFixed(1)}%
          </span>
          <span>Цель {(target * 100).toFixed(0)}%</span>
        </div>
        <ProgressBarAtom
          value={currentWeight * 100}
          max={target * 150}
          color={isUnderweight ? colors.warning[500] : colors.brand[500]}
        />
      </div>
    </div>
  );
};
