"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { AIExplanationFeature } from "@/features/ai-explanation";
import {
  CalculateAllocationFeature,
  calculateAllocation,
} from "@/features/calculate-allocation";
import { ParsedPortfolio } from "@/features/portfolio-upload";
import { ButtonAtom } from "@/shared/atoms/ButtonAtom";
import { PortfolioPositionMolecule } from "@/shared/molecules/PortfolioPositionMolecule";
import { UserMenuMolecule } from "@/shared/molecules/UserMenuMolecule";
import { CardAtom } from "@/shared/atoms/CardAtom";
import { colors, spacing, typography } from "@/shared/ui/tokens";

function PortfolioPositionsContent({
  loading,
  portfolio,
  targetAllocations,
  depositAmount,
}: {
  loading: boolean;
  portfolio: ParsedPortfolio | null;
  targetAllocations: Record<string, number>;
  depositAmount: number;
}) {
  // Compute projected weights after deposit allocation
  const projectedWeights = useMemo(() => {
    if (!portfolio || depositAmount <= 0) return null;

    const recommendations = calculateAllocation(
      portfolio,
      depositAmount,
      portfolio.prices ?? {},
      targetAllocations,
    );

    const totalAfter = portfolio.totalValue + depositAmount;
    const weights: Record<string, number> = {};

    // Non-rebalanced ETFs: value stays the same, but weight drops
    // because the total portfolio grows by depositAmount
    for (const [symbol, value] of Object.entries(portfolio.positions)) {
      weights[symbol] = totalAfter > 0 ? value / totalAfter : 0;
    }

    // Apply recommendations: ETFs receiving new money get updated weights
    for (const rec of recommendations) {
      const currentValue = portfolio.positions[rec.symbol] || 0;
      weights[rec.symbol] = (currentValue + rec.amount) / totalAfter;
    }

    return weights;
  }, [portfolio, depositAmount, targetAllocations]);

  if (loading) {
    return <p style={{ color: colors.neutral[500] }}>⏳ Загрузка...</p>;
  }

  if (!portfolio) {
    return (
      <p style={{ color: colors.neutral[500] }}>
        Загрузите скриншот портфеля для отображения данных
      </p>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: spacing[3],
      }}
    >
      {Object.entries(portfolio.positions).map(([symbol, value]) => {
        const currentWeight =
          portfolio.totalValue > 0 ? value / portfolio.totalValue : 0;
        const target = targetAllocations[symbol] || 0;
        const price = portfolio.prices?.[symbol];
        const shares = portfolio.shares?.[symbol];
        const newWeight = projectedWeights?.[symbol];
        return (
          <PortfolioPositionMolecule
            key={symbol}
            symbol={symbol}
            value={value}
            weight={currentWeight * 100}
            targetWeight={target * 100}
            newWeight={newWeight !== undefined ? newWeight * 100 : undefined}
            price={price}
            shares={shares}
          />
        );
      })}
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const [amount, setAmount] = useState(0);
  const [calculationTrigger, setCalculationTrigger] = useState(0);
  const [portfolio, setPortfolio] = useState<ParsedPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetAllocations, setTargetAllocations] = useState<
    Record<string, number>
  >({});
  const [loadingTargets, setLoadingTargets] = useState(true);

  // Загружаем последний снапшот из БД при монтировании
  useEffect(() => {
    fetch("/api/portfolio-snapshot")
      .then((res) => res.json())
      .then((data) => {
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Загружаем целевые доли
  useEffect(() => {
    fetch("/api/portfolio-rules")
      .then((res) => res.json())
      .then((data) => {
        const rules: Record<string, number> = {};
        for (const rule of data.rules) {
          rules[rule.symbol] = rule.targetWeight;
        }
        setTargetAllocations(rules);
      })
      .catch(() => setTargetAllocations({}))
      .finally(() => setLoadingTargets(false));
  }, []);

  const handleCalculate = useCallback(() => {
    setCalculationTrigger((prev) => prev + 1);
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: `${spacing[2]} ${spacing[4]}`,
          borderBottom: `1px solid ${colors.neutral[200]}`,
          backgroundColor: colors.neutral[0],
        }}
      >
        <UserMenuMolecule />
      </header>
      <main
        style={{
          minHeight: "calc(100vh - 60px)",
          backgroundColor: colors.neutral[50],
          padding: `${spacing[6]} ${spacing[4]}`,
        }}
      >
        <div
          style={{
            width: "100%",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: spacing[4],
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            <Link href="/rules">
              <ButtonAtom variant="secondary" size="sm">
                ⚙️ Правила портфеля
              </ButtonAtom>
            </Link>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing[4],
              alignItems: "start",
            }}
          >
            <div
              style={{
                flex: "1 1 300px",
                minWidth: "280px",
                display: "grid",
                gap: spacing[4],
              }}
            >
              <CalculateAllocationFeature
                amount={amount}
                onAmountChange={setAmount}
                onCalculate={handleCalculate}
                portfolio={portfolio || undefined}
              />
            </div>
            <div style={{ flex: "1 1 300px", minWidth: "280px" }}>
              <AIExplanationFeature
                amount={amount}
                trigger={calculationTrigger}
                portfolio={portfolio}
              />
            </div>
          </div>

          {/* 📊 Текущий портфель из БД — на всю ширину */}
          <CardAtom>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing[4],
                flexWrap: "wrap",
                gap: spacing[2],
              }}
            >
              <h2
                style={{
                  fontSize: typography.fontSize.xl,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.neutral[900],
                  fontFamily: typography.fontFamily.sans.join(", "),
                }}
              >
                📊 Текущий портфель
              </h2>
              <span
                style={{
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.neutral[500],
                  fontFamily: typography.fontFamily.sans.join(", "),
                }}
              >
                ${portfolio?.totalValue?.toLocaleString() || "0"}
              </span>
            </div>

            <PortfolioPositionsContent
              loading={loading || loadingTargets}
              portfolio={portfolio}
              targetAllocations={targetAllocations}
              depositAmount={amount}
            />
          </CardAtom>
        </div>
      </main>
    </div>
  );
}
