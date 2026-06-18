"use client";

import { colors, radius, spacing, typography } from "@/shared/ui/tokens";

export interface InputAtomProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  placeholder?: string;
  prefix?: string;
}

export const InputAtom = ({
  value,
  onChange,
  label,
  placeholder,
  prefix,
}: InputAtomProps) => {
  return (
    <div style={{ width: "100%" }}>
      {label && (
        <label
          style={{
            display: "block",
            marginBottom: spacing[2],
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            color: colors.neutral[700],
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: `1px solid ${colors.neutral[300]}`,
          borderRadius: radius.md,
          backgroundColor: colors.neutral[0],
          transition: `border-color 150ms ease`,
        }}
      >
        {prefix && (
          <span
            style={{
              paddingLeft: spacing[3],
              color: colors.neutral[500],
              fontSize: typography.fontSize.base,
              fontWeight: typography.fontWeight.medium,
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            flex: 1,
            padding: spacing[3],
            fontSize: typography.fontSize.base,
            fontFamily: typography.fontFamily.sans.join(", "),
            color: colors.neutral[900],
            border: "none",
            outline: "none",
            backgroundColor: "transparent",
          }}
        />
      </div>
    </div>
  );
};
