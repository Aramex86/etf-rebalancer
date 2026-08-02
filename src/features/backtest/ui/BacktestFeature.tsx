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

  // Launch form state.
  const [capital, setCapital] = useState("1000");
  const [model, setModel] = useState("gemma4:31b-cloud");

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
  }, [capital, model, loadRuns, loadDetail]);

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
            <strong>Модель LLM</strong> — какая Ollama-модель принимает решения
            (gemma4:31b-cloud, qwen3:480b и др.).
            <br />
            <strong>Параметры симуляции:</strong> 3 года истории цен, недельные
            шаги (~156 недель), макс 3 одновременные позиции, до 50% кэша на
            одну позицию, минимальная сделка $50, комиссия $1 + 0.05% спред,
            налог 12% на реализованную прибыль.
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: spacing[3],
            alignItems: isMobile ? "stretch" : "flex-end",
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
