"use client";

import { colors, radius, spacing, typography } from "@/shared/ui/tokens";

export interface AIExplanationMoleculeProps {
  explanation: string;
  loading: boolean;
}

export const AIExplanationMolecule = ({
  explanation,
  loading,
}: AIExplanationMoleculeProps) => {
  return (
    <div
      style={{
        marginTop: spacing[6],
        padding: spacing[6],
        backgroundColor: colors.brand[50],
        border: `1px solid ${colors.brand[200]}`,
        borderRadius: radius.lg,
        borderLeft: `4px solid ${colors.brand[500]}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[2],
          marginBottom: spacing[3],
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.brand[700],
          fontFamily: typography.fontFamily.sans.join(", "),
          textTransform: "uppercase",
          letterSpacing: typography.letterSpacing.wide,
        }}
      >
        🤖 AI объяснение
      </div>
      <div
        style={{
          fontSize: typography.fontSize.base,
          lineHeight: typography.lineHeight.relaxed,
          color: colors.neutral[700],
          fontFamily: typography.fontFamily.sans.join(", "),
        }}
      >
        {loading ? (
          <span
            style={{ display: "flex", alignItems: "center", gap: spacing[2] }}
          >
            <span
              style={{
                display: "inline-block",
                width: spacing[4],
                height: spacing[4],
                border: `2px solid ${colors.brand[200]}`,
                borderTopColor: colors.brand[500],
                borderRadius: radius.full,
                animation: "spin 1s linear infinite",
              }}
            />
            Думаю...
          </span>
        ) : (
          explanation
        )}
      </div>
    </div>
  );
};
