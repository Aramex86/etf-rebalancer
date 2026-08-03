// src/features/backtest/ui/RunListMolecule.tsx

"use client";

import { colors, spacing, typography } from "@/shared/ui/tokens";
import { shadows } from "@/shared/ui/tokens/spacing";
import { useIsMobile } from "@/shared/lib/useMediaQuery";
import type { RunListItem } from "@/entities/backtest";

interface RunListMoleculeProps {
  runs: RunListItem[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
  onDelete: (runId: string) => void;
  deletingRunId?: string | null;
}

const statusLabel: Record<string, string> = {
  running: "🔄 Запущен",
  paused: "⏸ Пауза",
  done: "✅ Завершён",
  failed: "❌ Ошибка",
};

const statusColor: Record<string, string> = {
  running: colors.brand[600],
  paused: colors.warning[600],
  done: colors.success[600],
  failed: colors.danger[600],
};

/** WIN / LOSS / DRAW badge based on total return. */
function resultBadge(ret: number | null): {
  label: string;
  bg: string;
  fg: string;
} {
  if (ret === null)
    return { label: "—", bg: colors.neutral[100], fg: colors.neutral[400] };
  if (ret > 0.01)
    return {
      label: "🏆 Выигрыш",
      bg: colors.success[50],
      fg: colors.success[700],
    };
  if (ret < -0.01)
    return {
      label: "📉 Проигрыш",
      bg: colors.danger[50],
      fg: colors.danger[700],
    };
  return {
    label: "➖ Ничья",
    bg: colors.neutral[100],
    fg: colors.neutral[500],
  };
}

/**
 * List of past backtest runs. Click to view details.
 */
export function RunListMolecule({
  runs,
  selectedRunId,
  onSelect,
  onDelete,
  deletingRunId,
}: RunListMoleculeProps) {
  const isMobile = useIsMobile();

  if (runs.length === 0) {
    return null;
  }

  const fmtPct = (v: number | null) =>
    v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  if (isMobile) {
    return (
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}
      >
        {runs.map((run) => {
          const isSelected = run.runId === selectedRunId;
          return (
            <div
              key={run.runId}
              style={{
                backgroundColor: isSelected
                  ? colors.brand[50]
                  : colors.neutral[0],
                border: `1px solid ${isSelected ? colors.brand[300] : colors.neutral[200]}`,
                borderRadius: "0.5rem",
                padding: spacing[3],
                fontFamily: typography.fontFamily.sans.join(", "),
              }}
            >
              <div
                onClick={() => onSelect(run.runId)}
                style={{
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: spacing[1],
                  }}
                >
                  <span
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: statusColor[run.status],
                      fontWeight: typography.fontWeight.semibold,
                    }}
                  >
                    {statusLabel[run.status]}
                  </span>
                  <span
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.neutral[400],
                    }}
                  >
                    {run.createdAt.slice(0, 16)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.neutral[700],
                    fontWeight: typography.fontWeight.medium,
                  }}
                >
                  {run.model}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: spacing[4],
                    marginTop: spacing[1],
                    fontSize: typography.fontSize.xs,
                    color: colors.neutral[500],
                  }}
                >
                  <span>Return: {fmtPct(run.totalReturnPct)}</span>
                  <span>vs B&H: {fmtPct(run.vsBuyHoldDeltaPct)}</span>
                  <span>Trades: {run.totalTrades}</span>
                </div>
                <div style={{ marginTop: spacing[2] }}>
                  {(() => {
                    const b = resultBadge(run.totalReturnPct);
                    return (
                      <span
                        style={{
                          display: "inline-block",
                          padding: `${spacing[1]} ${spacing[2]}`,
                          borderRadius: "0.25rem",
                          backgroundColor: b.bg,
                          color: b.fg,
                          fontSize: typography.fontSize.xs,
                          fontWeight: typography.fontWeight.semibold,
                        }}
                      >
                        {b.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div style={{ marginTop: spacing[2], textAlign: "right" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(run.runId);
                  }}
                  disabled={deletingRunId === run.runId}
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.danger[600],
                    backgroundColor: "transparent",
                    border: "none",
                    cursor:
                      deletingRunId === run.runId ? "not-allowed" : "pointer",
                    padding: 0,
                    opacity: deletingRunId === run.runId ? 0.5 : 1,
                  }}
                >
                  {deletingRunId === run.runId ? "⏳ Удаление…" : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop table.
  return (
    <div
      style={{
        backgroundColor: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: "0.5rem",
        overflow: "hidden",
        boxShadow: shadows.sm,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: typography.fontFamily.sans.join(", "),
          fontSize: typography.fontSize.sm,
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: colors.neutral[50],
              borderBottom: `1px solid ${colors.neutral[200]}`,
            }}
          >
            {[
              "Статус",
              "Модель",
              "Дата",
              "Результат",
              "Доходность",
              "vs B&H",
              "Trades",
              "",
            ].map((h) => (
              <th
                key={h}
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  textAlign: "left",
                  fontSize: typography.fontSize.xs,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.neutral[500],
                  textTransform: "uppercase",
                  letterSpacing: typography.letterSpacing.wide,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const isSelected = run.runId === selectedRunId;
            const ret = run.totalReturnPct;
            const vsBh = run.vsBuyHoldDeltaPct;
            return (
              <tr
                key={run.runId}
                onClick={() => onSelect(run.runId)}
                style={{
                  backgroundColor: isSelected ? colors.brand[50] : undefined,
                  borderBottom: `1px solid ${colors.neutral[100]}`,
                  cursor: "pointer",
                }}
              >
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    color: statusColor[run.status],
                    fontWeight: typography.fontWeight.semibold,
                  }}
                >
                  {statusLabel[run.status]}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    fontWeight: typography.fontWeight.medium,
                  }}
                >
                  {run.model}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    color: colors.neutral[500],
                  }}
                >
                  {run.createdAt.slice(0, 16)}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                  }}
                >
                  {(() => {
                    const b = resultBadge(ret);
                    return (
                      <span
                        style={{
                          display: "inline-block",
                          padding: `${spacing[1]} ${spacing[2]}`,
                          borderRadius: "0.25rem",
                          backgroundColor: b.bg,
                          color: b.fg,
                          fontSize: typography.fontSize.xs,
                          fontWeight: typography.fontWeight.semibold,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.label}
                      </span>
                    );
                  })()}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    color:
                      ret === null
                        ? colors.neutral[400]
                        : ret >= 0
                          ? colors.success[600]
                          : colors.danger[600],
                    fontWeight:
                      ret !== null ? typography.fontWeight.semibold : "normal",
                  }}
                >
                  {fmtPct(ret)}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    color:
                      vsBh === null
                        ? colors.neutral[400]
                        : vsBh >= 0
                          ? colors.success[600]
                          : colors.danger[600],
                    fontWeight:
                      vsBh !== null ? typography.fontWeight.semibold : "normal",
                  }}
                >
                  {fmtPct(vsBh)}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    color: colors.neutral[500],
                  }}
                >
                  {run.totalTrades}
                </td>
                <td
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    textAlign: "right",
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(run.runId);
                    }}
                    disabled={deletingRunId === run.runId}
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.danger[600],
                      backgroundColor: "transparent",
                      border: "none",
                      cursor:
                        deletingRunId === run.runId ? "not-allowed" : "pointer",
                      padding: 0,
                      opacity: deletingRunId === run.runId ? 0.5 : 1,
                    }}
                  >
                    {deletingRunId === run.runId ? "⏳" : "Delete"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
