"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ButtonAtom } from "@/shared/atoms/ButtonAtom";
import { CardAtom } from "@/shared/atoms/CardAtom";
import { BadgeAtom } from "@/shared/atoms/BadgeAtom";
import { colors, radius, spacing, typography } from "@/shared/ui/tokens";
import { useIsMobile } from "@/shared/lib/useMediaQuery";
import {
  PortfolioRulesTableMolecule,
  type PortfolioRulesTablePosition,
  type PortfolioRulesTableRow,
} from "@/shared/molecules/PortfolioRulesTableMolecule";
import { PortfolioRule, ParsedPortfolio } from "@/entities/portfolio";
import {
  fetchPortfolioRules,
  initializeDefaultRules,
  savePortfolioRulesBatch,
} from "../api/rules";

interface EditableRule extends PortfolioRule {
  isDirty: boolean;
}

interface PortfolioRulesFeatureProps {
  portfolio?: ParsedPortfolio | null;
}

function toEditableRules(rules: PortfolioRule[]): EditableRule[] {
  return rules.map((rule) => ({ ...rule, isDirty: false }));
}

function toTableRows(rules: EditableRule[]): PortfolioRulesTableRow[] {
  return rules.map((rule) => ({
    symbol: rule.symbol,
    name: rule.name,
    targetWeight: rule.targetWeight,
    price: rule.price,
    isDirty: rule.isDirty,
  }));
}

function toTablePositions(
  portfolio: ParsedPortfolio | null | undefined,
): Record<string, PortfolioRulesTablePosition> | undefined {
  if (!portfolio || portfolio.totalValue <= 0) return undefined;

  return Object.fromEntries(
    Object.entries(portfolio.positions).map(([symbol, value]) => [
      symbol,
      {
        value,
        weight: value / portfolio.totalValue,
      },
    ]),
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function calculateTotalWeight(rules: EditableRule[]): number {
  return rules.reduce((sum, rule) => sum + rule.targetWeight, 0);
}

export function PortfolioRulesFeature({
  portfolio,
}: PortfolioRulesFeatureProps) {
  const [rules, setRules] = useState<EditableRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isMobile = useIsMobile();

  console.log("rules", isMobile);

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPortfolioRules();
      setRules(toEditableRules(data));
    } catch (err) {
      setError("Не удалось загрузить правила портфеля");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const dirtyRules = rules.filter((rule) => rule.isDirty);

    if (dirtyRules.length === 0) {
      setSuccess("Нет изменений для сохранения");
      return;
    }

    const totalWeight = calculateTotalWeight(rules);
    if (Math.abs(totalWeight - 1) > 0.001) {
      setError(
        `Сумма целевых долей должна быть 100%. Сейчас: ${(totalWeight * 100).toFixed(1)}%`,
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updated = await savePortfolioRulesBatch(
        dirtyRules.map((rule) => ({
          symbol: rule.symbol,
          name: rule.name,
          targetWeight: rule.targetWeight,
          price: rule.price,
        })),
      );

      setRules(toEditableRules(updated));
      setSuccess("Правила сохранены");
    } catch (err) {
      setError("Не удалось сохранить правила");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetToDefaults() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await initializeDefaultRules();
      await loadRules();
      setSuccess("Правила сброшены к значениям по умолчанию");
    } catch (err) {
      setError("Не удалось сбросить правила");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function updateRule(symbol: string, updates: Partial<PortfolioRule>) {
    setRules((prev) =>
      prev.map((rule) =>
        rule.symbol === symbol ? { ...rule, ...updates, isDirty: true } : rule,
      ),
    );
    setSuccess(null);
  }

  const totalWeight = calculateTotalWeight(rules);
  const isWeightValid = Math.abs(totalWeight - 1) <= 0.001;
  const dirtyCount = rules.filter((rule) => rule.isDirty).length;

  return (
    <CardAtom>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing[6],
          flexWrap: "wrap",
          gap: spacing[3],
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
          <Link href="/">
            <ButtonAtom variant="secondary" size="sm">
              ← Назад
            </ButtonAtom>
          </Link>
          <h2
            style={{
              fontSize: typography.fontSize.xl,
              fontWeight: typography.fontWeight.semibold,
              color: colors.neutral[900],
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            ⚙️ Правила портфеля
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: isWeightValid ? colors.success[600] : colors.danger[600],
              fontWeight: typography.fontWeight.medium,
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            Сумма долей: {(totalWeight * 100).toFixed(1)}%
          </span>
          {!isWeightValid && (
            <BadgeAtom variant="danger">
              {formatPercent(totalWeight)} ≠ 100%
            </BadgeAtom>
          )}
          {isWeightValid && dirtyCount > 0 && (
            <BadgeAtom variant="warning">{dirtyCount} изменений</BadgeAtom>
          )}
        </div>
      </div>

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: spacing[8],
            color: colors.neutral[500],
            fontSize: typography.fontSize.base,
          }}
        >
          ⏳ Загрузка правил...
        </div>
      ) : (
        <>
          <PortfolioRulesTableMolecule
            rules={toTableRows(rules)}
            positions={toTablePositions(portfolio)}
            isMobile={isMobile}
            onUpdateRule={updateRule}
          />

          {error && (
            <div
              style={{
                marginTop: spacing[4],
                padding: spacing[4],
                backgroundColor: colors.danger[50],
                border: `1px solid ${colors.danger[200]}`,
                borderRadius: radius.md,
                color: colors.danger[700],
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily.sans.join(", "),
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div
              style={{
                marginTop: spacing[4],
                padding: spacing[4],
                backgroundColor: colors.success[50],
                border: `1px solid ${colors.success[200]}`,
                borderRadius: radius.md,
                color: colors.success[700],
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily.sans.join(", "),
              }}
            >
              ✅ {success}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: spacing[3],
              marginTop: spacing[6],
              flexWrap: "wrap",
            }}
          >
            <ButtonAtom
              onClick={handleSave}
              disabled={saving || dirtyCount === 0 || !isWeightValid}
              size="md"
              fullWidth
            >
              💾 Сохранить изменения
            </ButtonAtom>

            <ButtonAtom
              variant="secondary"
              onClick={handleResetToDefaults}
              disabled={saving}
              size="md"
              fullWidth
            >
              🔄 Сбросить к умолчанию
            </ButtonAtom>
          </div>
        </>
      )}
    </CardAtom>
  );
}
