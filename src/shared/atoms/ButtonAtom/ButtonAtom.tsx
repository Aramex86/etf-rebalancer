// src/shared/atoms/ButtonAtom/ButtonAtom.tsx

"use client";

import {
  colors,
  radius,
  spacing,
  typography,
  transitions,
} from "@/shared/ui/tokens";

type Variant = "primary" | "secondary" | "success";
type Size = "sm" | "md" | "lg";

export interface ButtonAtomProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: { backgroundColor: colors.brand[500], color: colors.neutral[0] },
  secondary: {
    backgroundColor: colors.neutral[100],
    color: colors.neutral[900],
  },
  success: { backgroundColor: colors.success[500], color: colors.neutral[0] },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
  },
  md: {
    padding: `${spacing[3]} ${spacing[6]}`,
    fontSize: typography.fontSize.base,
  },
  lg: {
    padding: `${spacing[4]} ${spacing[8]}`,
    fontSize: typography.fontSize.lg,
  },
};

export const ButtonAtom = ({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  onClick,
  type = "button",
}: ButtonAtomProps) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: typography.fontFamily.sans.join(", "),
        fontWeight: typography.fontWeight.semibold,
        borderRadius: radius.md,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? "100%" : "auto",
        transition: `all ${transitions.duration.fast} ${transitions.easing.inOut}`,
        ...variantStyles[variant],
        ...sizeStyles[size],
      }}
    >
      {children}
    </button>
  );
};
