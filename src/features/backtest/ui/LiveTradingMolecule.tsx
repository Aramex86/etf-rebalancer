// src/features/backtest/ui/LiveTradingMolecule.tsx

"use client";

import { colors, spacing, typography } from "@/shared/ui/tokens";
import { shadows } from "@/shared/ui/tokens/spacing";
import { useIsMobile } from "@/shared/lib/useMediaQuery";
import type { LiveStepResponse } from "../api/backtestApi";

export interface LiveTradeHistoryItem {
  id: number;
  date: string;
  symbol: string;
  action: "buy" | "sell";
  shares: number;
  price: number;
  amountUsd: number;
  commission: number;
  tax: number | null;
  realizedPnl: number | null;
  reasoning: string | null;
}

interface LiveTradingMoleculeProps {
  liveResult: LiveStepResponse | null;
  isLiveRunning: boolean;
  liveError: string | null;
  liveHistory: LiveTradeHistoryItem[];
  onStep: () => void;
  onReset: () => void;
  helpOpen: Record<string, boolean>;
  toggleHelp: (key: string) => void;
}

/**
 * Live paper trading panel — real Yahoo prices, virtual trades.
 * Contains: action buttons, result card, trade stats, full history.
 */
export function LiveTradingMolecule({
  liveResult,
  isLiveRunning,
  liveError,
  liveHistory,
  onStep,
  onReset,
  helpOpen,
  toggleHelp,
}: LiveTradingMoleculeProps) {
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
          marginBottom: spacing[1],
        }}
      >
        🔴 Live режим — торговля по реальным ценам
        <button
          type="button"
          onClick={() => toggleHelp("live")}
          aria-label="Как работает live режим"
          style={helpBtnStyle(helpOpen["live"])}
        >
          ?
        </button>
      </div>
      <div
        style={{
          fontSize: typography.fontSize.sm,
          color: colors.neutral[500],
          fontFamily: typography.fontFamily.sans.join(", "),
          marginBottom: spacing[4],
          lineHeight: typography.lineHeight.normal,
        }}
      >
        Агент получает свежие цены ETF из Yahoo Finance и принимает решение
        прямо сейчас. Сделки виртуальные, но цены реальные. Баланс обновляется и
        сохраняется.
      </div>
      {helpOpen["live"] && (
        <div style={helpPanelStyle}>
          <strong>Live режим</strong> — это paper trading (бумажная торговля).
          Агент видит реальные текущие цены ETF с биржи, анализирует их и решает
          купить/продать. Сделки исполняются по реальным ценам, но деньги
          виртуальные. Баланс сохраняется в БД и не сбрасывается при
          перезагрузке. Нажмите «Сделать шаг» — агент один раз проанализирует
          рынок и совершит сделки.
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: spacing[3],
          flexWrap: "wrap",
          marginBottom: spacing[4],
        }}
      >
        <button
          onClick={onStep}
          disabled={isLiveRunning}
          style={{
            padding: `${spacing[2]} ${spacing[4]}`,
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.semibold,
            color: colors.neutral[0],
            backgroundColor: isLiveRunning
              ? colors.brand[400]
              : colors.brand[600],
            border: "none",
            borderRadius: "0.375rem",
            cursor: isLiveRunning ? "not-allowed" : "pointer",
            opacity: isLiveRunning ? 0.7 : 1,
          }}
        >
          {isLiveRunning ? "⏳ Анализ рынка…" : "📊 Сделать шаг"}
        </button>
        <button
          onClick={onReset}
          disabled={isLiveRunning}
          style={{
            padding: `${spacing[2]} ${spacing[4]}`,
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.semibold,
            color: colors.danger[600],
            backgroundColor: "transparent",
            border: `1px solid ${colors.danger[300]}`,
            borderRadius: "0.375rem",
            cursor: isLiveRunning ? "not-allowed" : "pointer",
            opacity: isLiveRunning ? 0.5 : 1,
          }}
        >
          🔄 Сбросить
        </button>
      </div>

      {/* Error */}
      {liveError && (
        <div
          style={{
            backgroundColor: colors.danger[50],
            border: `1px solid ${colors.danger[200]}`,
            borderRadius: "0.5rem",
            padding: `${spacing[2]} ${spacing[3]}`,
            fontSize: typography.fontSize.sm,
            color: colors.danger[700],
            marginBottom: spacing[3],
          }}
        >
          ❌ {liveError}
        </div>
      )}

      {/* Result */}
      {liveResult && <LiveResultCard result={liveResult} />}

      {/* Full trade history */}
      {liveHistory.length > 0 && <LiveTradeHistory history={liveHistory} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LiveResultCard({ result }: { result: LiveStepResponse }) {
  return (
    <div
      style={{
        backgroundColor: colors.neutral[50],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: "0.5rem",
        padding: spacing[4],
      }}
    >
      {/* Summary row */}
      <div
        style={{
          display: "flex",
          gap: spacing[4],
          flexWrap: "wrap",
          marginBottom: spacing[3],
        }}
      >
        <LiveStat label="Дата" value={result.date} />
        <LiveStat
          label="💰 Баланс"
          value={`$${result.totalValue.toFixed(2)}`}
          bold
        />
        <LiveStat
          label="P&L"
          value={`${result.pnlUsd >= 0 ? "+" : ""}$${result.pnlUsd.toFixed(2)} (${result.pnlPct >= 0 ? "+" : ""}${result.pnlPct.toFixed(2)}%)`}
          color={
            result.pnlUsd > 0
              ? colors.success[600]
              : result.pnlUsd < 0
                ? colors.danger[600]
                : colors.neutral[500]
          }
          bold
        />
        <LiveStat
          label="Кэш"
          value={`$${result.cash.toFixed(2)}`}
          color={colors.neutral[700]}
        />
      </div>

      {/* Current step trades */}
      {result.actions.length > 0 && (
        <div style={{ marginBottom: spacing[3] }}>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.neutral[700],
              marginBottom: spacing[2],
            }}
          >
            Сделки:
          </div>
          {result.actions.map((t, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: spacing[3],
                padding: `${spacing[1]} 0`,
                fontSize: typography.fontSize.sm,
                color: colors.neutral[600],
              }}
            >
              <span
                style={{
                  fontWeight: typography.fontWeight.semibold,
                  color:
                    t.action === "buy"
                      ? colors.success[600]
                      : colors.danger[600],
                }}
              >
                {t.action === "buy" ? "BUY" : "SELL"}
              </span>
              <span>{t.symbol}</span>
              <span>
                {t.shares} shares @ ${t.price.toFixed(2)}
              </span>
              <span>${t.amountUsd.toFixed(2)}</span>
              {t.realizedPnl !== null && (
                <span
                  style={{
                    color:
                      t.realizedPnl >= 0
                        ? colors.success[600]
                        : colors.danger[600],
                  }}
                >
                  P&L: {t.realizedPnl >= 0 ? "+" : ""}$
                  {t.realizedPnl.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reasoning */}
      {result.reasoning && (
        <div
          style={{
            backgroundColor: colors.brand[50],
            border: `1px solid ${colors.brand[100]}`,
            borderRadius: "0.375rem",
            padding: `${spacing[2]} ${spacing[3]}`,
            fontSize: typography.fontSize.sm,
            color: colors.neutral[700],
            lineHeight: typography.lineHeight.normal,
          }}
        >
          🤖 {result.reasoning}
        </div>
      )}

      {/* Market prices */}
      {result.markets.length > 0 && (
        <div style={{ marginTop: spacing[3] }}>
          <div
            style={{
              fontSize: typography.fontSize.xs,
              color: colors.neutral[500],
              textTransform: "uppercase",
              letterSpacing: typography.letterSpacing.wide,
              marginBottom: spacing[1],
            }}
          >
            Текущие цены ETF:
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing[2],
            }}
          >
            {result.markets.map((m) => (
              <span
                key={m.symbol}
                style={{
                  fontSize: typography.fontSize.xs,
                  color: colors.neutral[600],
                  backgroundColor: colors.neutral[100],
                  padding: `${spacing[1]} ${spacing[2]}`,
                  borderRadius: "0.25rem",
                }}
              >
                {m.symbol}: ${m.currentPrice.toFixed(2)}{" "}
                <span style={{ color: colors.neutral[400] }}>
                  RSI {m.rsi14.toFixed(0)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trade statistics */}
      {result.tradeStats && <LiveTradeStats stats={result.tradeStats} />}
    </div>
  );
}

function LiveStat({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: typography.fontSize.xs,
          color: colors.neutral[500],
          textTransform: "uppercase",
          letterSpacing: typography.letterSpacing.wide,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: typography.fontSize.base,
          fontWeight: bold
            ? typography.fontWeight.bold
            : typography.fontWeight.semibold,
          color: color ?? colors.neutral[900],
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LiveTradeStats({
  stats,
}: {
  stats: NonNullable<LiveStepResponse["tradeStats"]>;
}) {
  const statCard = (label: string, value: string, bg: string, fg: string) => (
    <div
      style={{
        backgroundColor: bg,
        borderRadius: "0.375rem",
        padding: `${spacing[2]} ${spacing[3]}`,
      }}
    >
      <div style={{ fontSize: typography.fontSize.xs, color: fg }}>{label}</div>
      <div
        style={{
          fontSize: typography.fontSize.base,
          fontWeight: typography.fontWeight.bold,
          color: fg,
        }}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div
      style={{
        marginTop: spacing[3],
        paddingTop: spacing[3],
        borderTop: `1px solid ${colors.neutral[200]}`,
      }}
    >
      <div
        style={{
          fontSize: typography.fontSize.xs,
          color: colors.neutral[500],
          textTransform: "uppercase",
          letterSpacing: typography.letterSpacing.wide,
          marginBottom: spacing[2],
        }}
      >
        📊 Статистика сделок
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spacing[3],
        }}
      >
        {statCard(
          "Всего сделок",
          `${stats.totalTrades} (BUY ${stats.totalBuys} / SELL ${stats.totalSells})`,
          colors.neutral[100],
          colors.neutral[900],
        )}
        {statCard(
          "🏆 Выигрышей",
          String(stats.wins),
          colors.success[50],
          colors.success[600],
        )}
        {statCard(
          "📉 Проигрышей",
          String(stats.losses),
          colors.danger[50],
          colors.danger[600],
        )}
        {statCard(
          "Win Rate",
          `${stats.winRate.toFixed(1)}%`,
          colors.neutral[100],
          colors.neutral[900],
        )}
        {statCard(
          "💰 Реализованный P&L",
          `${stats.totalRealizedPnl >= 0 ? "+" : ""}$${stats.totalRealizedPnl.toFixed(2)}`,
          stats.totalRealizedPnl >= 0 ? colors.success[50] : colors.danger[50],
          stats.totalRealizedPnl > 0
            ? colors.success[600]
            : stats.totalRealizedPnl < 0
              ? colors.danger[600]
              : colors.neutral[500],
        )}
        {statCard(
          "💸 Комиссии + налог",
          `$${(stats.totalCommissions + stats.totalTax).toFixed(2)}`,
          colors.neutral[100],
          colors.neutral[600],
        )}
        {statCard(
          "📈 Лучшая сделка",
          `+$${stats.bestTradePnl.toFixed(2)}`,
          colors.success[50],
          colors.success[600],
        )}
        {statCard(
          "📉 Худшая сделка",
          `$${stats.worstTradePnl.toFixed(2)}`,
          colors.danger[50],
          colors.danger[600],
        )}
      </div>
    </div>
  );
}

function LiveTradeHistory({ history }: { history: LiveTradeHistoryItem[] }) {
  return (
    <div
      style={{
        marginTop: spacing[3],
        borderTop: `1px solid ${colors.neutral[200]}`,
        paddingTop: spacing[3],
      }}
    >
      <div
        style={{
          fontSize: typography.fontSize.xs,
          color: colors.neutral[500],
          textTransform: "uppercase",
          letterSpacing: typography.letterSpacing.wide,
          marginBottom: spacing[2],
        }}
      >
        📋 История сделок ({history.length})
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing[1],
          maxHeight: "300px",
          overflowY: "auto",
        }}
      >
        {history.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              gap: spacing[2],
              alignItems: "center",
              padding: `${spacing[1]} ${spacing[2]}`,
              fontSize: typography.fontSize.sm,
              backgroundColor: colors.neutral[50],
              borderRadius: "0.25rem",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                color: colors.neutral[400],
                fontSize: typography.fontSize.xs,
                minWidth: "70px",
              }}
            >
              {t.date}
            </span>
            <span
              style={{
                fontWeight: typography.fontWeight.bold,
                color:
                  t.action === "buy" ? colors.success[600] : colors.danger[600],
                minWidth: "44px",
              }}
            >
              {t.action === "buy" ? "BUY" : "SELL"}
            </span>
            <span
              style={{
                fontWeight: typography.fontWeight.semibold,
                color: colors.neutral[700],
                minWidth: "60px",
              }}
            >
              {t.symbol}
            </span>
            <span style={{ color: colors.neutral[600] }}>
              {t.shares} @ ${t.price.toFixed(2)}
            </span>
            <span
              style={{
                color: colors.neutral[500],
                fontSize: typography.fontSize.xs,
              }}
            >
              ${t.amountUsd.toFixed(2)}
            </span>
            <span
              style={{
                color: colors.neutral[400],
                fontSize: typography.fontSize.xs,
              }}
            >
              comm ${t.commission.toFixed(2)}
            </span>
            {t.realizedPnl !== null && (
              <span
                style={{
                  fontWeight: typography.fontWeight.semibold,
                  color:
                    t.realizedPnl >= 0
                      ? colors.success[600]
                      : colors.danger[600],
                  fontSize: typography.fontSize.xs,
                }}
              >
                P&L: {t.realizedPnl >= 0 ? "+" : ""}${t.realizedPnl.toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
