"use client";

import { colors, radius, spacing } from "@/shared/ui/tokens";

interface ProgressBarAtomProps {
  value: number;
  max?: number;
  color?: string;
  backgroundColor?: string;
  height?: string;
}

export const ProgressBarAtom = ({
  value,
  max = 100,
  color = colors.brand[500],
  backgroundColor = colors.neutral[200],
  height = spacing[2],
}: ProgressBarAtomProps) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      style={{
        width: "100%",
        height,
        backgroundColor,
        borderRadius: radius.full,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${percentage}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: radius.full,
          transition: "width 300ms ease-out",
        }}
      />
    </div>
  );
};
