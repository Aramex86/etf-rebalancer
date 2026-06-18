"use client";

import { colors, radius, shadows, spacing } from "@/shared/ui/tokens";

export interface CardAtomProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "brand";
  shadow?: "sm" | "md" | "lg" | "none";
}

const cardVariantStyles: Record<string, React.CSSProperties> = {
  default: {
    backgroundColor: colors.neutral[0],
    border: `1px solid ${colors.neutral[200]}`,
  },
  success: {
    backgroundColor: colors.success[50],
    border: `1px solid ${colors.success[200]}`,
  },
  brand: {
    backgroundColor: colors.brand[50],
    border: `1px solid ${colors.brand[200]}`,
  },
};

const cardShadowStyles: Record<string, React.CSSProperties> = {
  sm: { boxShadow: shadows.sm },
  md: { boxShadow: shadows.md },
  lg: { boxShadow: shadows.lg },
  none: { boxShadow: "none" },
};

export const CardAtom = ({
  children,
  variant = "default",
  shadow = "sm",
}: CardAtomProps) => {
  return (
    <div
      style={{
        padding: spacing[5],
        borderRadius: radius.lg,
        marginBottom: spacing[4],
        ...cardVariantStyles[variant],
        ...cardShadowStyles[shadow],
      }}
    >
      {children}
    </div>
  );
};
