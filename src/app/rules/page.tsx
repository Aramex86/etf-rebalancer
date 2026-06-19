"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { PortfolioRulesFeature } from "@/features/portfolio-rules";
import {
  PortfolioUploadFeature,
  ParsedPortfolio,
} from "@/features/portfolio-upload";
import { PortfolioPositionMolecule } from "@/shared/molecules/PortfolioPositionMolecule";
import { UserMenuMolecule } from "@/shared/molecules/UserMenuMolecule";
import { CardAtom } from "@/shared/atoms/CardAtom";
import { ButtonAtom } from "@/shared/atoms/ButtonAtom";
import { colors, spacing, typography } from "@/shared/ui/tokens";
import { useIsMobile } from "@/shared/lib/useMediaQuery";

function PortfolioPositionsContent({
  loading,
  portfolio,
  targetAllocations,
}: {
  loading: boolean;
  portfolio: ParsedPortfolio | null;
  targetAllocations: Record<string, number>;
}) {
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
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: spacing[3],
      }}
    >
      {Object.entries(portfolio.positions).map(([symbol, value]) => {
        const currentWeight =
          portfolio.totalValue > 0 ? value / portfolio.totalValue : 0;
        const target = targetAllocations[symbol] || 0;
        const price = portfolio.prices?.[symbol];
        const shares = portfolio.shares?.[symbol];
        return (
          <PortfolioPositionMolecule
            key={symbol}
            symbol={symbol}
            value={value}
            weight={currentWeight * 100}
            targetWeight={target * 100}
            price={price}
            shares={shares}
          />
        );
      })}
    </div>
  );
}

export default function RulesPage() {
  const [portfolio, setPortfolio] = useState<ParsedPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetAllocations, setTargetAllocations] = useState<
    Record<string, number>
  >({});
  const [loadingTargets, setLoadingTargets] = useState(true);
  const isMobile = useIsMobile();

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

  const handlePortfolioParsed = useCallback((parsed: ParsedPortfolio) => {
    setPortfolio(parsed);
  }, []);

  return (
    <>
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
          minHeight: "100vh",
          backgroundColor: colors.neutral[50],
          padding: isMobile
            ? `${spacing[3]} ${spacing[2]}`
            : `${spacing[6]} ${spacing[4]}`,
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
            <Link href="/dashboard">
              <ButtonAtom variant="secondary" size="sm">
                ← Назад
              </ButtonAtom>
            </Link>
          </div>

          <PortfolioUploadFeature onPortfolioParsed={handlePortfolioParsed} />

          {/* 📊 Текущий портфель из БД */}
          <CardAtom>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: isMobile ? "flex-start" : "center",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? spacing[1] : 0,
                marginBottom: spacing[4],
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
            />
          </CardAtom>

          <PortfolioRulesFeature />
        </div>
      </main>
    </>
  );
}
