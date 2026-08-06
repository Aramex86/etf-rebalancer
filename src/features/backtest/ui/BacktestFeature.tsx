// src/features/backtest/ui/BacktestFeature.tsx

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colors, spacing, typography } from "@/shared/ui/tokens";
import { shadows } from "@/shared/ui/tokens/spacing";
import { useIsMobile } from "@/shared/lib/useMediaQuery";
import type {
  BacktestSummary,
  BacktestTradeRecord,
  BacktestSnapshotRecord,
  RunListItem,
} from "@/entities/backtest";
import {
  startRun,
  runStepRequest,
  finishRun,
  listRuns,
  getRunDetail,
  deleteRun,
  liveStep,
  getLiveState,
  resetLive,
  type LiveStepResponse,
} from "../api/backtestApi";
import { MetricsMolecule } from "./MetricsMolecule";
import { PortfolioChart } from "./PortfolioChart";
import { TradesTable } from "./TradesTable";
import { RunListMolecule } from "./RunListMolecule";

/**
 * Full backtest simulator feature.
 *
 * States:
 * 1. Empty — no runs yet → show launch form
 * 2. Run list — past runs, click to view details
 * 3. Run detail — metrics + chart + trades
 * 4. Running — live progress bar while simulation executes
 */
export function BacktestFeature() {
  const isMobile = useIsMobile();

  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Launch form state — persisted in localStorage.
  const [capital, setCapital] = useState(() => {
    if (typeof window === "undefined") return "1000";
    return window.localStorage.getItem("backtest_capital") ?? "1000";
  });
  const [model, setModel] = useState("gemma4:31b-cloud");
  // Cumulative mode: after a run, set capital = endValue for the next run.
  const [cumulativeMode, setCumulativeMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("backtest_cumulative") === "true";
  });
  // Original starting capital (for cumulative P&L tracking).
  const [baseCapital, setBaseCapital] = useState(() => {
    if (typeof window === "undefined") return 0;
    return (
      Number.parseFloat(
        window.localStorage.getItem("backtest_baseCapital") ?? "0",
      ) || 0
    );
  });

  // Persist to localStorage on change.
  useEffect(() => {
    window.localStorage.setItem("backtest_capital", capital);
  }, [capital]);
  useEffect(() => {
    window.localStorage.setItem(
      "backtest_cumulative",
      cumulativeMode ? "true" : "false",
    );
  }, [cumulativeMode]);
  useEffect(() => {
    window.localStorage.setItem("backtest_baseCapital", String(baseCapital));
  }, [baseCapital]);

  // Simulation state.
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{
    week: number;
    total: number;
  } | null>(null);
  const [runStatus, setRunStatus] = useState<string>("");

  // Detail view state.
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [trades, setTrades] = useState<BacktestTradeRecord[]>([]);
  const [snapshots, setSnapshots] = useState<BacktestSnapshotRecord[]>([]);
  const [startValue, setStartValue] = useState(1000);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState<Record<string, boolean>>({});
  const toggleHelp = (key: string) =>
    setHelpOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  // Live paper trading state.
  const [liveResult, setLiveResult] = useState<LiveStepResponse | null>(null);
  const [isLiveRunning, setIsLiveRunning] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveHistory, setLiveHistory] = useState<
    Array<{
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
    }>
  >([]);

  /** Load live trading history on mount. */
  const loadLiveHistory = useCallback(async () => {
    try {
      const state = await getLiveState();
      setLiveHistory(state.trades);
    } catch {
      // Ignore — no live state yet.
    }
  }, []);

  useEffect(() => {
    loadLiveHistory();
  }, [loadLiveHistory]);

  const didInitialLoadRef = useRef(false);

  /** Load list of runs. */
  const loadRuns = useCallback(async () => {
    try {
      setError(null);
      const data = await listRuns();
      setRuns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runs");
    } finally {
      setIsLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    loadRuns();
  }, [loadRuns]);

  /** Load details for a selected run. */
  const loadDetail = useCallback(async (runId: string) => {
    setIsLoadingDetail(true);
    setError(null);
    try {
      const detail = await getRunDetail(runId);
      setSummary(detail.summary);
      setTrades(detail.trades);
      setSnapshots(detail.snapshots);
      setStartValue(detail.run.startValue);
      setSelectedRunId(runId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load run details",
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  /** Delete a run and refresh the list. */
  const handleDelete = useCallback(
    async (runId: string) => {
      setDeletingRunId(runId);
      setError(null);
      try {
        await deleteRun(runId);
        if (selectedRunId === runId) {
          setSelectedRunId(null);
          setSummary(null);
          setTrades([]);
          setSnapshots([]);
        }
        await loadRuns();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete run");
      } finally {
        setDeletingRunId(null);
      }
    },
    [selectedRunId, loadRuns],
  );

  /** Launch a new backtest run. */
  const handleLaunch = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setSummary(null);
    setTrades([]);
    setSnapshots([]);
    setSelectedRunId(null);
    setRunStatus("Запуск симуляции…");

    try {
      const capitalNum = Number.parseFloat(capital) || 1000;
      // In cumulative mode, lock baseCapital on first run.
      if (cumulativeMode && baseCapital === 0) {
        setBaseCapital(capitalNum);
      }
      const startResp = await startRun({ model, capital: capitalNum });
      const { runId, totalWeeks } = startResp;

      setProgress({ week: 0, total: totalWeeks });

      // Execute all steps sequentially.
      for (let week = 1; week <= totalWeeks; week++) {
        setProgress({ week, total: totalWeeks });
        setRunStatus(`Неделя ${week}/${totalWeeks}…`);
        await runStepRequest(runId, week);
      }

      // Finish — calculate metrics.
      setRunStatus("Расчёт метрик…");
      const finishResp = await finishRun(runId);

      setSummary(finishResp.summary);
      setRunStatus("");

      // Cumulative mode: carry over endValue as next run's starting capital.
      if (cumulativeMode && finishResp.summary.endValue > 0) {
        setCapital(finishResp.summary.endValue.toFixed(2));
      }

      // Reload run list + load details.
      await loadRuns();
      await loadDetail(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setRunStatus("");
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }, [capital, model, cumulativeMode, loadRuns, loadDetail]);

  /** Execute one live trading step (real prices from Yahoo). */
  const handleLiveStep = useCallback(async () => {
    setIsLiveRunning(true);
    setLiveError(null);
    try {
      const result = await liveStep(model);
      setLiveResult(result);
      // Sync "Банк агента" with live portfolio value.
      setCapital(result.totalValue.toFixed(2));
      if (baseCapital === 0) {
        setBaseCapital(result.startingCapital);
      }
      // Reload full trade history.
      await loadLiveHistory();
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : "Live step failed");
    } finally {
      setIsLiveRunning(false);
    }
  }, [model, baseCapital, loadLiveHistory]);

  /** Reset live portfolio. */
  const handleLiveReset = useCallback(async () => {
    try {
      const capitalNum = Number.parseFloat(capital) || 1000;
      await resetLive(capitalNum);
      setLiveResult(null);
      setLiveError(null);
      setLiveHistory([]);
      // Reset "Банк агента" to the starting capital.
      setBaseCapital(capitalNum);
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : "Reset failed");
    }
  }, [capital]);

  // --- Loading state ---
  if (isLoadingRuns) {
    return (
      <div
        style={{
          padding: spacing[8],
          textAlign: "center",
          color: colors.neutral[500],
          fontSize: typography.fontSize.base,
          fontFamily: typography.fontFamily.sans.join(", "),
        }}
      >
        ⏳ Загрузка симулятора…
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: spacing[4],
  };

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
    <div style={containerStyle}>
      {/* Error banner */}
      {error && (
        <div
          style={{
            backgroundColor: colors.danger[50],
            border: `1px solid ${colors.danger[200]}`,
            borderRadius: "0.5rem",
            padding: `${spacing[3]} ${spacing[4]}`,
            fontSize: typography.fontSize.sm,
            color: colors.danger[700],
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* Launch form */}
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
          🤖 Swing Trading Симулятор
          <button
            type="button"
            onClick={() => toggleHelp("launch")}
            aria-label="Как работает симулятор"
            style={helpBtnStyle(helpOpen["launch"])}
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
          LLM-агент торгует UCITS ETF на исторических данных (3 года). Покупает
          на просадках, продаёт на росте. Прибыль реинвестируется. Сравнение со
          стратегией Buy &amp; Hold.
        </div>
        {helpOpen["launch"] && (
          <div style={helpPanelStyle}>
            <strong>Стартовый капитал</strong> — сумма ($), с которой агент
            начинает торговлю.
            <br />
            <strong>Накопительный режим</strong> — если включён, после
            завершения прогона стартовый капитал следующего автоматически
            становится равным конечному капиталу предыдущего. Так агент
            продолжает торговать с накопленным результатом — задача приумножить
            капитал через несколько прогонов.
            <br />
            <strong>Модель LLM</strong> — какая Ollama-модель принимает решения
            (gemma4:31b-cloud, qwen3:480b и др.).
            <br />
            <strong>Параметры симуляции:</strong> 3 года истории цен, недельные
            шаги (~156 недель), макс 3 одновременные позиции, до 50% кэша на
            одну позицию, минимальная сделка $50, комиссия $1 + 0.05% спред,
            налог 12% на реализованную прибыль.
          </div>
        )}

        {(cumulativeMode || liveResult) &&
          baseCapital > 0 &&
          (() => {
            const currentCapital = Number.parseFloat(capital) || 0;
            const pnlUsd = currentCapital - baseCapital;
            const pnlPct = baseCapital > 0 ? (pnlUsd / baseCapital) * 100 : 0;
            const isProfit = pnlUsd > 0;
            const isLoss = pnlUsd < 0;
            return (
              <div
                style={{
                  display: "flex",
                  gap: spacing[3],
                  flexWrap: "wrap",
                  backgroundColor: isProfit
                    ? colors.success[50]
                    : isLoss
                      ? colors.danger[50]
                      : colors.neutral[50],
                  border: `1px solid ${
                    isProfit
                      ? colors.success[200]
                      : isLoss
                        ? colors.danger[200]
                        : colors.neutral[200]
                  }`,
                  borderRadius: "0.5rem",
                  padding: `${spacing[3]} ${spacing[4]}`,
                  marginBottom: spacing[4],
                  fontFamily: typography.fontFamily.sans.join(", "),
                }}
              >
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.neutral[500],
                      textTransform: "uppercase",
                      letterSpacing: typography.letterSpacing.wide,
                      marginBottom: spacing[1],
                    }}
                  >
                    🏦 Банк агента
                  </div>
                  <div
                    style={{
                      fontSize: typography.fontSize.xl,
                      fontWeight: typography.fontWeight.bold,
                      color: colors.neutral[900],
                    }}
                  >
                    ${currentCapital.toFixed(2)}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.neutral[500],
                      textTransform: "uppercase",
                      letterSpacing: typography.letterSpacing.wide,
                      marginBottom: spacing[1],
                    }}
                  >
                    Стартовый
                  </div>
                  <div
                    style={{
                      fontSize: typography.fontSize.xl,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.neutral[600],
                    }}
                  >
                    ${baseCapital.toFixed(2)}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.neutral[500],
                      textTransform: "uppercase",
                      letterSpacing: typography.letterSpacing.wide,
                      marginBottom: spacing[1],
                    }}
                  >
                    {isProfit ? "📈 Прибыль" : isLoss ? "📉 Убыток" : "➖ P&L"}
                  </div>
                  <div
                    style={{
                      fontSize: typography.fontSize.xl,
                      fontWeight: typography.fontWeight.bold,
                      color: isProfit
                        ? colors.success[600]
                        : isLoss
                          ? colors.danger[600]
                          : colors.neutral[500],
                    }}
                  >
                    {isProfit ? "+" : ""}${pnlUsd.toFixed(2)}
                    <span style={{ fontSize: typography.fontSize.sm }}>
                      {" "}
                      ({isProfit ? "+" : ""}
                      {pnlPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: spacing[3],
            alignItems: isMobile ? "stretch" : "",
          }}
        >
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: typography.fontSize.xs,
                color: colors.neutral[500],
                fontFamily: typography.fontFamily.sans.join(", "),
                marginBottom: spacing[1],
                textTransform: "uppercase",
                letterSpacing: typography.letterSpacing.wide,
              }}
            >
              Стартовый капитал ($)
            </label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              disabled={isRunning}
              style={{
                width: "100%",
                padding: `${spacing[2]} ${spacing[3]}`,
                fontSize: typography.fontSize.base,
                fontFamily: typography.fontFamily.sans.join(", "),
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: "0.375rem",
                outline: "none",
                backgroundColor: colors.neutral[0],
                color: colors.neutral[900],
              }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing[2],
                marginTop: spacing[2],
                fontSize: typography.fontSize.xs,
                color: colors.neutral[600],
                fontFamily: typography.fontFamily.sans.join(", "),
                cursor: isRunning ? "not-allowed" : "pointer",
                opacity: isRunning ? 0.6 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={cumulativeMode}
                onChange={(e) => {
                  setCumulativeMode(e.target.checked);
                  if (!e.target.checked) {
                    setBaseCapital(0);
                  }
                }}
                disabled={isRunning}
                style={{ cursor: "pointer" }}
              />
              Накопительный режим это
              <br />
              капитал следующего прогона = результат предыдущего
            </label>
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: typography.fontSize.xs,
                color: colors.neutral[500],
                fontFamily: typography.fontFamily.sans.join(", "),
                marginBottom: spacing[1],
                textTransform: "uppercase",
                letterSpacing: typography.letterSpacing.wide,
              }}
            >
              Модель LLM
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isRunning}
              style={{
                width: "100%",
                padding: `${spacing[2]} ${spacing[3]}`,
                fontSize: typography.fontSize.base,
                fontFamily: typography.fontFamily.sans.join(", "),
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: "0.375rem",
                outline: "none",
                backgroundColor: colors.neutral[0],
                color: colors.neutral[900],
              }}
            />
          </div>
          <button
            onClick={handleLaunch}
            disabled={isRunning}
            style={{
              padding: `${spacing[2]} ${spacing[6]}`,
              fontSize: typography.fontSize.base,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily.sans.join(", "),
              color: colors.neutral[0],
              backgroundColor: isRunning
                ? colors.neutral[400]
                : colors.brand[500],
              border: "none",
              borderRadius: "0.375rem",
              cursor: isRunning ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              height: "39px",
              marginTop: isMobile ? 0 : "20px",
            }}
          >
            {isRunning ? "⏳ Выполняется…" : "🚀 Запустить"}
          </button>
        </div>

        {/* Progress bar */}
        {isRunning && progress && (
          <div style={{ marginTop: spacing[4] }}>
            <div
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.neutral[600],
                fontFamily: typography.fontFamily.sans.join(", "),
                marginBottom: spacing[2],
              }}
            >
              {runStatus}
            </div>
            <div
              style={{
                width: "100%",
                height: 8,
                backgroundColor: colors.neutral[200],
                borderRadius: "0.25rem",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress.total > 0 ? (progress.week / progress.total) * 100 : 0}%`,
                  height: "100%",
                  backgroundColor: colors.brand[500],
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.neutral[400],
                fontFamily: typography.fontFamily.sans.join(", "),
                marginTop: spacing[1],
                textAlign: "right",
              }}
            >
              {progress.week} / {progress.total}
            </div>
          </div>
        )}
      </div>

      {/* Run detail view */}
      {selectedRunId && summary && (
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
            📊 Результаты: {selectedRunId}
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
              <strong>Доходность</strong> — общий возврат: (конец − старт) /
              старт × 100%.
              <br />
              <strong>vs Buy &amp; Hold</strong> — разница доходности агента и
              стратегии «купи и держи» (капитал поровну по всем ETF).
              <br />
              <strong>Sharpe Ratio</strong> — годовой коэффициент Шарпа
              (безрисковая = 0). &gt;1 — хорошая доходность с учётом риска.
              <br />
              <strong>Max Drawdown</strong> — максимальная просадка от пика
              портфеля.
              <br />
              <strong>Win Rate</strong> — доля прибыльных продаж (P&amp;L &gt;
              0).
              <br />
              <strong>Комиссии + Налоги</strong> — суммарные затраты на торговлю
              за весь прогон.
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
                График стоимости портфеля по неделям. Синяя линия — портфель
                агента (кэш + позиции по ценам закрытия). Пунктирная серая линия
                — стартовый капитал для сравнения. Наведите курсор на точку
                чтобы увидеть точную стоимость и номер недели.
              </div>
            )}
            <PortfolioChart
              snapshots={snapshots}
              startingCapital={startValue}
            />
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
                себестоимость − налог 12%. Комиссия = max($1, 0.05% от суммы).
                На мобильном — карточки, на десктопе — полная таблица.
              </div>
            )}
            <TradesTable trades={trades} />
          </div>
        </div>
      )}

      {/* Loading detail */}
      {isLoadingDetail && (
        <div style={cardStyle}>
          <div
            style={{
              padding: spacing[4],
              textAlign: "center",
              color: colors.neutral[500],
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            ⏳ Загрузка деталей прогона…
          </div>
        </div>
      )}

      {/* Live Paper Trading */}
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
          прямо сейчас. Сделки виртуальные, но цены реальные. Баланс обновляется
          и сохраняется.
        </div>
        {helpOpen["live"] && (
          <div style={helpPanelStyle}>
            <strong>Live режим</strong> — это paper trading (бумажная торговля).
            Агент видит реальные текущие цены ETF с биржи, анализирует их и
            решает купить/продать. Сделки исполняются по реальным ценам, но
            деньги виртуальные. Баланс сохраняется в БД и не сбрасывается при
            перезагрузке. Нажмите «Сделать шаг» — агент один раз проанализирует
            рынок и совершит сделки.
          </div>
        )}

        {/* Live action buttons */}
        <div
          style={{
            display: "flex",
            gap: spacing[3],
            flexWrap: "wrap",
            marginBottom: spacing[4],
          }}
        >
          <button
            onClick={handleLiveStep}
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
            onClick={handleLiveReset}
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

        {/* Live error */}
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

        {/* Live result */}
        {liveResult && (
          <div
            style={{
              backgroundColor: colors.neutral[50],
              border: `1px solid ${colors.neutral[200]}`,
              borderRadius: "0.5rem",
              padding: spacing[4],
            }}
          >
            <div
              style={{
                display: "flex",
                gap: spacing[4],
                flexWrap: "wrap",
                marginBottom: spacing[3],
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.neutral[500],
                    textTransform: "uppercase",
                    letterSpacing: typography.letterSpacing.wide,
                  }}
                >
                  Дата
                </div>
                <div
                  style={{
                    fontSize: typography.fontSize.base,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.neutral[900],
                  }}
                >
                  {liveResult.date}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.neutral[500],
                    textTransform: "uppercase",
                    letterSpacing: typography.letterSpacing.wide,
                  }}
                >
                  💰 Баланс
                </div>
                <div
                  style={{
                    fontSize: typography.fontSize.base,
                    fontWeight: typography.fontWeight.bold,
                    color: colors.neutral[900],
                  }}
                >
                  ${liveResult.totalValue.toFixed(2)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.neutral[500],
                    textTransform: "uppercase",
                    letterSpacing: typography.letterSpacing.wide,
                  }}
                >
                  P&L
                </div>
                <div
                  style={{
                    fontSize: typography.fontSize.base,
                    fontWeight: typography.fontWeight.bold,
                    color:
                      liveResult.pnlUsd > 0
                        ? colors.success[600]
                        : liveResult.pnlUsd < 0
                          ? colors.danger[600]
                          : colors.neutral[500],
                  }}
                >
                  {liveResult.pnlUsd >= 0 ? "+" : ""}$
                  {liveResult.pnlUsd.toFixed(2)} (
                  {liveResult.pnlPct >= 0 ? "+" : ""}
                  {liveResult.pnlPct.toFixed(2)}%)
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.neutral[500],
                    textTransform: "uppercase",
                    letterSpacing: typography.letterSpacing.wide,
                  }}
                >
                  Кэш
                </div>
                <div
                  style={{
                    fontSize: typography.fontSize.base,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.neutral[700],
                  }}
                >
                  ${liveResult.cash.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Trades */}
            {liveResult.actions.length > 0 && (
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
                {liveResult.actions.map((t, i) => (
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
            {liveResult.reasoning && (
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
                🤖 {liveResult.reasoning}
              </div>
            )}

            {/* Market data */}
            {liveResult.markets.length > 0 && (
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
                  {liveResult.markets.map((m) => (
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
            {liveResult.tradeStats && (
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
                  <div
                    style={{
                      backgroundColor: colors.neutral[100],
                      borderRadius: "0.375rem",
                      padding: `${spacing[2]} ${spacing[3]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.neutral[500],
                      }}
                    >
                      Всего сделок
                    </div>
                    <div
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.neutral[900],
                      }}
                    >
                      {liveResult.tradeStats.totalTrades}
                      <span
                        style={{
                          fontSize: typography.fontSize.xs,
                          color: colors.neutral[400],
                          fontWeight: typography.fontWeight.regular,
                        }}
                      >
                        {" "}
                        (BUY {liveResult.tradeStats.totalBuys} / SELL{" "}
                        {liveResult.tradeStats.totalSells})
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: colors.success[50],
                      borderRadius: "0.375rem",
                      padding: `${spacing[2]} ${spacing[3]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.success[600],
                      }}
                    >
                      🏆 Выигрышей
                    </div>
                    <div
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.success[600],
                      }}
                    >
                      {liveResult.tradeStats.wins}
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: colors.danger[50],
                      borderRadius: "0.375rem",
                      padding: `${spacing[2]} ${spacing[3]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.danger[600],
                      }}
                    >
                      📉 Проигрышей
                    </div>
                    <div
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.danger[600],
                      }}
                    >
                      {liveResult.tradeStats.losses}
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: colors.neutral[100],
                      borderRadius: "0.375rem",
                      padding: `${spacing[2]} ${spacing[3]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.neutral[500],
                      }}
                    >
                      Win Rate
                    </div>
                    <div
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.neutral[900],
                      }}
                    >
                      {liveResult.tradeStats.winRate.toFixed(1)}%
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor:
                        liveResult.tradeStats.totalRealizedPnl >= 0
                          ? colors.success[50]
                          : colors.danger[50],
                      borderRadius: "0.375rem",
                      padding: `${spacing[2]} ${spacing[3]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.neutral[500],
                      }}
                    >
                      💰 Реализованный P&L
                    </div>
                    <div
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.bold,
                        color:
                          liveResult.tradeStats.totalRealizedPnl > 0
                            ? colors.success[600]
                            : liveResult.tradeStats.totalRealizedPnl < 0
                              ? colors.danger[600]
                              : colors.neutral[500],
                      }}
                    >
                      {liveResult.tradeStats.totalRealizedPnl >= 0 ? "+" : ""}${" "}
                      {liveResult.tradeStats.totalRealizedPnl.toFixed(2)}
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: colors.neutral[100],
                      borderRadius: "0.375rem",
                      padding: `${spacing[2]} ${spacing[3]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.neutral[500],
                      }}
                    >
                      💸 Комиссии + налог
                    </div>
                    <div
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.neutral[600],
                      }}
                    >
                      ${" "}
                      {(
                        liveResult.tradeStats.totalCommissions +
                        liveResult.tradeStats.totalTax
                      ).toFixed(2)}
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: colors.success[50],
                      borderRadius: "0.375rem",
                      padding: `${spacing[2]} ${spacing[3]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.success[600],
                      }}
                    >
                      📈 Лучшая сделка
                    </div>
                    <div
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.success[600],
                      }}
                    >
                      +${liveResult.tradeStats.bestTradePnl.toFixed(2)}
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: colors.danger[50],
                      borderRadius: "0.375rem",
                      padding: `${spacing[2]} ${spacing[3]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.danger[600],
                      }}
                    >
                      📉 Худшая сделка
                    </div>
                    <div
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.danger[600],
                      }}
                    >
                      ${liveResult.tradeStats.worstTradePnl.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full trade history */}
        {liveHistory.length > 0 && (
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
              📋 История сделок ({liveHistory.length})
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
              {liveHistory.map((t) => (
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
                        t.action === "buy"
                          ? colors.success[600]
                          : colors.danger[600],
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
                      P&L: {t.realizedPnl >= 0 ? "+" : ""}${" "}
                      {t.realizedPnl.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Run list */}
      {runs.length > 0 && (
        <div style={cardStyle}>
          <div
            style={{
              fontSize: typography.fontSize.base,
              fontWeight: typography.fontWeight.semibold,
              color: colors.neutral[700],
              fontFamily: typography.fontFamily.sans.join(", "),
              marginBottom: spacing[3],
            }}
          >
            📜 История прогонов
            <button
              type="button"
              onClick={() => toggleHelp("history")}
              aria-label="Как пользоваться историей"
              style={helpBtnStyle(helpOpen["history"])}
            >
              ?
            </button>
          </div>
          {helpOpen["history"] && (
            <div style={helpPanelStyle}>
              Список прошлых прогонов симуляции. <strong>Клик</strong> по строке
              — просмотр деталей (метрики, график, сделки).{" "}
              <strong>Удалить</strong> — удаляет прогон и все связанные данные
              (сделки, снимки). Статус: 🔄 запущен, ✅ завершён, ❌ ошибка.
            </div>
          )}
          <RunListMolecule
            runs={runs}
            selectedRunId={selectedRunId}
            onSelect={loadDetail}
            onDelete={handleDelete}
            deletingRunId={deletingRunId}
          />
        </div>
      )}
    </div>
  );
}
