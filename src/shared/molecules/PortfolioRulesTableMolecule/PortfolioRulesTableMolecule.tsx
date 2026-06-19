"use client";

import { BadgeAtom } from "@/shared/atoms/BadgeAtom";
import { colors, radius, spacing, typography } from "@/shared/ui/tokens";

export interface PortfolioRulesTableRow {
  symbol: string;
  name: string;
  targetWeight: number;
  price: number | null;
  isDirty: boolean;
}

export interface PortfolioRulesTablePosition {
  value: number;
  weight: number;
}

interface PortfolioRulesTableMoleculeProps {
  rules: PortfolioRulesTableRow[];
  positions?: Record<string, PortfolioRulesTablePosition | undefined>;
  isMobile: boolean;
  onUpdateRule: (
    symbol: string,
    updates: Partial<PortfolioRulesTableRow>,
  ) => void;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercentValue(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatPrice(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "";
  return value.toString();
}

function parsePercentInput(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed / 100;
}

function parsePriceInput(value: string): number | null {
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function getWeightColor(
  currentWeight: number | null,
  targetWeight: number,
): string {
  if (currentWeight === null) return colors.neutral[400];
  return Math.abs(currentWeight - targetWeight) > 0.05
    ? colors.warning[600]
    : colors.success[600];
}

interface PortfolioRulesTableRowMoleculeProps {
  rule: PortfolioRulesTableRow;
  position: PortfolioRulesTablePosition | undefined;
  isMobile: boolean;
  onUpdateRule: (
    symbol: string,
    updates: Partial<PortfolioRulesTableRow>,
  ) => void;
}

function getCellPadding(isMobile: boolean): string {
  return isMobile
    ? `${spacing[2]} ${spacing[2]}`
    : `${spacing[3]} ${spacing[4]}`;
}

function getMobileFontSize(isMobile: boolean): string {
  return isMobile ? typography.fontSize.sm : typography.fontSize.base;
}

function PortfolioRulesTableRowMolecule({
  rule,
  position,
  isMobile,
  onUpdateRule,
}: PortfolioRulesTableRowMoleculeProps) {
  const currentWeight = position?.weight ?? null;
  const cellPadding = getCellPadding(isMobile);
  const mobileFontSize = getMobileFontSize(isMobile);

  return (
    <tr>
      <td
        style={{
          padding: cellPadding,
          borderBottom: `1px solid ${colors.neutral[100]}`,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            fontFamily: typography.fontFamily.mono.join(", "),
            fontWeight: typography.fontWeight.semibold,
            fontSize: mobileFontSize,
            color: colors.neutral[900],
          }}
        >
          {rule.symbol}
        </span>
      </td>
      {!isMobile && (
        <td
          style={{
            padding: `${spacing[3]} ${spacing[4]}`,
            borderBottom: `1px solid ${colors.neutral[100]}`,
          }}
        >
          <input
            type="text"
            value={rule.name}
            onChange={(e) =>
              onUpdateRule(rule.symbol, { name: e.target.value })
            }
            style={{
              width: "100%",
              padding: spacing[2],
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily.sans.join(", "),
              color: colors.neutral[700],
              border: `1px solid ${colors.neutral[200]}`,
              borderRadius: radius.sm,
              backgroundColor: colors.neutral[0],
            }}
          />
        </td>
      )}
      <td
        style={{
          padding: cellPadding,
          borderBottom: `1px solid ${colors.neutral[100]}`,
        }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={`${(rule.targetWeight * 100).toFixed(0)}%`}
          onChange={(e) =>
            onUpdateRule(rule.symbol, {
              targetWeight: parsePercentInput(e.target.value),
            })
          }
          style={{
            width: isMobile ? "56px" : "80px",
            padding: spacing[2],
            fontSize: mobileFontSize,
            fontFamily: typography.fontFamily.mono.join(", "),
            color: colors.neutral[900],
            border: `1px solid ${colors.neutral[200]}`,
            borderRadius: radius.sm,
            backgroundColor: colors.neutral[0],
            textAlign: "right",
          }}
        />
      </td>
      <td
        style={{
          padding: cellPadding,
          borderBottom: `1px solid ${colors.neutral[100]}`,
          textAlign: "right",
          whiteSpace: "nowrap",
          fontFamily: typography.fontFamily.mono.join(", "),
          fontSize: mobileFontSize,
          color: getWeightColor(currentWeight, rule.targetWeight),
        }}
      >
        {currentWeight !== null ? formatPercentValue(currentWeight * 100) : "—"}
      </td>
      <td
        style={{
          padding: cellPadding,
          borderBottom: `1px solid ${colors.neutral[100]}`,
        }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={formatPrice(rule.price)}
          onChange={(e) =>
            onUpdateRule(rule.symbol, {
              price: parsePriceInput(e.target.value),
            })
          }
          style={{
            width: isMobile ? "64px" : "100px",
            padding: spacing[2],
            fontSize: mobileFontSize,
            fontFamily: typography.fontFamily.mono.join(", "),
            color: colors.neutral[900],
            border: `1px solid ${colors.neutral[200]}`,
            borderRadius: radius.sm,
            backgroundColor: colors.neutral[0],
            textAlign: "right",
          }}
        />
      </td>
      <td
        style={{
          padding: cellPadding,
          borderBottom: `1px solid ${colors.neutral[100]}`,
          textAlign: "right",
          whiteSpace: "nowrap",
          fontFamily: typography.fontFamily.mono.join(", "),
          fontSize: mobileFontSize,
          color: colors.neutral[900],
        }}
      >
        {position ? formatCurrency(position.value) : "—"}
      </td>
      {!isMobile && (
        <td
          style={{
            padding: cellPadding,
            borderBottom: `1px solid ${colors.neutral[100]}`,
            whiteSpace: "nowrap",
          }}
        >
          {rule.isDirty ? (
            <BadgeAtom variant="warning">изменено</BadgeAtom>
          ) : (
            <BadgeAtom variant="success">сохранено</BadgeAtom>
          )}
        </td>
      )}
    </tr>
  );
}

export function PortfolioRulesTableMolecule({
  rules,
  positions,
  isMobile,
  onUpdateRule,
}: PortfolioRulesTableMoleculeProps) {
  const headers = [
    "Тикер",
    ...(isMobile ? [] : ["Название"]),
    "Целевая",
    "Текущая",
    "Цена",
    "Сумма",
    ...(isMobile ? [] : ["Статус"]),
  ];

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: isMobile ? "max-content" : "100%",
          minWidth: isMobile ? "100%" : undefined,
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                style={{
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  padding: isMobile
                    ? `${spacing[2]} ${spacing[2]}`
                    : `${spacing[3]} ${spacing[4]}`,
                  fontSize: isMobile
                    ? typography.fontSize.xs
                    : typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.neutral[600],
                  borderBottom: `1px solid ${colors.neutral[200]}`,
                  fontFamily: typography.fontFamily.sans.join(", "),
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <PortfolioRulesTableRowMolecule
              key={rule.symbol}
              rule={rule}
              position={positions?.[rule.symbol]}
              isMobile={isMobile}
              onUpdateRule={onUpdateRule}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
