"use client";

import { useState } from "react";
import { CardAtom } from "@/shared/atoms/CardAtom";
import { RecommendationItemMolecule } from "@/shared/molecules/RecommendationItemMolecule";
import { AllocationHeader } from "./AllocationHeader";
import { colors, spacing, typography } from "@/shared/ui/tokens";
import { ETFRecommendation } from "@/entities/etf";
import { ETFPortfolio } from "@/entities/etf/model/etfTypes";
import { calculateAllocationFeature } from "../api/calculate";

export interface CalculateAllocationFeatureProps {
  amount: number;
  onAmountChange: (amount: number) => void;
  onCalculate?: () => void;
  portfolio?: ETFPortfolio | null;
}

export function CalculateAllocationFeature({
  amount,
  onAmountChange,
  onCalculate,
  portfolio,
}: CalculateAllocationFeatureProps) {
  const [recommendations, setRecommendations] = useState<ETFRecommendation[]>(
    [],
  );

  return (
    <div style={{ width: "100%", minWidth: "0" }}>
      <AllocationHeader
        amount={amount}
        onAmountChange={(value) => {
          onAmountChange(value);
          setRecommendations([]);
        }}
        onCalculate={async () => {
          const recs = await calculateAllocationFeature(amount, portfolio);
          setRecommendations(recs);
          onCalculate?.();
        }}
      />

      {recommendations.length > 0 && (
        <CardAtom variant="success">
          <h2
            style={{
              fontSize: typography.fontSize.xl,
              fontWeight: typography.fontWeight.semibold,
              color: colors.success[700],
              marginBottom: spacing[6],
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            💡 Рекомендуемое распределение ${amount.toLocaleString()}
          </h2>
          {recommendations.map((rec) => (
            <RecommendationItemMolecule
              key={rec.symbol}
              symbol={rec.symbol}
              currentWeight={rec.currentWeight}
              target={rec.target}
              amount={rec.amount}
              shares={rec.shares}
              newWeight={rec.newWeight}
            />
          ))}
        </CardAtom>
      )}
    </div>
  );
}
