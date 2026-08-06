// src/features/backtest/ui/RunDetailMolecule.tsx

"use client";

import { colors, spacing, typography } from "@/shared/ui/tokens";
import { shadows } from "@/shared/ui/tokens/spacing";
import { useIsMobile } from "@/shared/lib/useMediaQuery";
import type {
  BacktestSummary,
  BacktestTradeRecord,
  BacktestSnapshotRecord,
} from "@/entities/backtest";
import { MetricsMolecule } from "./MetricsMolecule";
import { PortfolioChart } from "./PortfolioChart";
import { TradesTable } from "./TradesTable";

interface RunDetailMoleculeProps {
  runId: string;
  summary: BacktestSummary;
  trades: BacktestTradeRecord[];
  snapshots: BacktestSnapshotRecord[];
  startValue: number;
  helpOpen: Record<string, boolean>;
  toggleHelp: (key: string) => void;
}

/**
 * Run detail card — metrics, portfolio chart, trades table.
 */
export function RunDetailMolecule({
  runId,
  summary,
  trades,
  snapshots,
  startValue,
  helpOpen,
  toggleHelp,
}: RunDetailMoleculeProps) {
  const isMobile = useIsMobile();

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.neutral[0],
    border: `1px solid ${colors.neutral[200]}`,
    borderRadius: "0.75rem",
    padding: isMobile ? spacing[4] : spacing[6],
    boxShadow: shadows.sm,
  };

  const helpBtnStyle = (open: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    border: `1px solid ${open ? colors.brand[500] : colors.neutral[300]}`,
    backgroundColor: open ? colors.brand[50] : colors.neutral[0],
    color: open ? colors.brand[600] : colors.neutral[500],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    fontFamily: typography.fontFamily.sans.join(", "),
    marginLeft: spacing[2],
    verticalAlign: "middle",
  });

  const helpPanelStyle: React.CSSProperties = {
    backgroundColor: colors.info[50],
    border: `1px solid ${colors.info[100]}`,
    borderRadius: "0.5rem",
    padding: `${spacing[3]} ${spacing[4]}`,
    marginTop: spacing[3],
    marginBottom: spacing[3],
    fontSize: typography.fontSize.xs,
    color: colors.neutral[600],
    fontFamily: typography.fontFamily.sans.join(", "),
    lineHeight: typography.lineHeight.normal,
  };

  return (
    <div style={cardStyle}>
      <div
        style={{
          fontSize: typography.fontSize.lg,
          fontWeight: typography.fontWeight.bold,
          color: colors.neutral[900],
          fontFamily: typography.fontFamily.sans.join(", "),
          marginBottom: spacing[4],
        }}
      >
        📊 Результаты: {runId}
        <button
          type="button"
          onClick={() => toggleHelp("metrics")}
          aria-label="Что значат метрики"
          style={helpBtnStyle(helpOpen["metrics"])}
        >
          ?
        </button>
      </div>

      {helpOpen["metrics"] && (
        <div style={helpPanelStyle}>
          <strong>Доходность</strong> — общий возврат: (конец − старт) / старт ×
          100%.
          <br />
          <strong>vs Buy &amp; Hold</strong> — разница доходности агента и
          стратегии «купи и держи» (капитал поровну по всем ETF).
          <br />
          <strong>Sharpe Ratio</strong> — годовой коэффициент Шарпа (безрисковая
          = 0). &gt;1 — хорошая доходность с учётом риска.
          <br />
          <strong>Max Drawdown</strong> — максимальная просадка от пика
          портфеля.
          <br />
          <strong>Win Rate</strong> — доля прибыльных продаж (P&amp;L &gt; 0).
          <br />
          <strong>Комиссии + Налоги</strong> — суммарные затраты на торговлю за
          весь прогон.
        </div>
      )}

      <MetricsMolecule summary={summary} />

      <div style={{ marginTop: spacing[4] }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: spacing[2],
          }}
        >
          <span
            style={{
              fontSize: typography.fontSize.base,
              fontWeight: typography.fontWeight.semibold,
              color: colors.neutral[700],
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            📈 График портфеля
          </span>
          <button
            type="button"
            onClick={() => toggleHelp("chart")}
            aria-label="Как читать график"
            style={helpBtnStyle(helpOpen["chart"])}
          >
            ?
          </button>
        </div>
        {helpOpen["chart"] && (
          <div style={helpPanelStyle}>
            График стоимости портфеля по неделям. Синяя линия — портфель агента
            (кэш + позиции по ценам закрытия). Пунктирная серая линия —
            стартовый капитал для сравнения. Наведите курсор на точку чтобы
            увидеть точную стоимость и номер недели.
          </div>
        )}
        <PortfolioChart snapshots={snapshots} startingCapital={startValue} />
      </div>

      <div style={{ marginTop: spacing[4] }}>
        <div
          style={{
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.semibold,
            color: colors.neutral[700],
            fontFamily: typography.fontFamily.sans.join(", "),
            marginBottom: spacing[2],
          }}
        >
          📋 Сделки ({trades.length})
          <button
            type="button"
            onClick={() => toggleHelp("trades")}
            aria-label="Как читать таблицу сделок"
            style={helpBtnStyle(helpOpen["trades"])}
          >
            ?
          </button>
        </div>
        {helpOpen["trades"] && (
          <div style={helpPanelStyle}>
            Все сделки агента за прогон. <strong>BUY</strong> (зелёный) —
            покупка на сумму amountUsd, цена с учётом спреда.{" "}
            <strong>SELL</strong> (красный) — продажа, P&amp;L = выручка −
            себестоимость − налог 12%. Комиссия = max($1, 0.05% от суммы). На
            мобильном — карточки, на десктопе — полная таблица.
          </div>
        )}
        <TradesTable trades={trades} />
      </div>
    </div>
  );
}
