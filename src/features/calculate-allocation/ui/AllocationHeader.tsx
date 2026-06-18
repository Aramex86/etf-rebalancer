"use client";

import { ButtonAtom } from "@/shared/atoms/ButtonAtom";
import { InputAtom } from "@/shared/atoms/InputAtom";
import {
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "@/shared/ui/tokens";

export interface AllocationHeaderProps {
  amount: number;
  onAmountChange: (amount: number) => void;
  onCalculate: () => void;
}

export function AllocationHeader({
  amount,
  onAmountChange,
  onCalculate,
}: AllocationHeaderProps) {
  return (
    <div
      style={{
        padding: spacing[6],
        backgroundColor: colors.neutral[0],
        borderRadius: radius.lg,
        boxShadow: shadows.sm,
        marginBottom: spacing[4],
      }}
    >
      <h1
        style={{
          fontSize: typography.fontSize["2xl"],
          fontWeight: typography.fontWeight.bold,
          color: colors.neutral[900],
          marginBottom: spacing[1],
          fontFamily: typography.fontFamily.sans.join(", "),
          letterSpacing: typography.letterSpacing.tight,
        }}
      >
        🎯 ETF Rebalancer
      </h1>
      <p
        style={{
          fontSize: typography.fontSize.sm,
          color: colors.neutral[500],
          marginBottom: spacing[5],
          fontFamily: typography.fontFamily.sans.join(", "),
        }}
      >
        Умное распределение пополнения для поддержания целевых долей ETF
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing[3],
          marginBottom: spacing[4],
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 180px", minWidth: "0" }}>
          <InputAtom
            value={amount}
            onChange={onAmountChange}
            label="💰 Сумма пополнения"
            prefix="$"
          />
        </div>
        <ButtonAtom onClick={onCalculate} size="md">
          🚀 Рассчитать
        </ButtonAtom>
      </div>
    </div>
  );
}
