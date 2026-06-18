"use client";

import { colors, radius, typography } from "@/shared/ui/tokens";

type BadgeVariant = "brand" | "success" | "warning" | "danger" | "neutral";

interface BadgeAtomProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const badgeVariantStyles: Record<BadgeVariant, React.CSSProperties> = {
  brand: { backgroundColor: colors.brand[100], color: colors.brand[700] },
  success: { backgroundColor: colors.success[100], color: colors.success[700] },
  warning: { backgroundColor: colors.warning[100], color: colors.warning[700] },
  danger: { backgroundColor: colors.danger[100], color: colors.danger[700] },
  neutral: { backgroundColor: colors.neutral[100], color: colors.neutral[700] },
};

export const BadgeAtom = ({
  children,
  variant = "neutral",
}: BadgeAtomProps) => {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.125rem 0.5rem",
        borderRadius: radius.full,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.sans.join(", "),
        ...badgeVariantStyles[variant],
      }}
    >
      {children}
    </span>
  );
};
