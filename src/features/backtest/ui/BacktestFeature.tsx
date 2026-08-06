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
import { LaunchFormMolecule } from "./LaunchFormMolecule";
import { RunDetailMolecule } from "./RunDetailMolecule";
import {
  LiveTradingMolecule,
  type LiveTradeHistoryItem,
} from "./LiveTradingMolecule";
import { RunListMolecule } from "./RunListMolecule";

/**
 * Full backtest simulator feature — thin orchestrator.
 *
 * State + callbacks live here. UI is delegated to molecules:
 * - LaunchFormMolecule   (capital, model, run button, progress, bank panel)
 * - RunDetailMolecule    (metrics, chart, trades)
 * - LiveTradingMolecule  (live paper trading panel)
 * - RunListMolecule      (past runs list)
 */
export function BacktestFeature() {
  const isMobile = useIsMobile();

  // --- Run list state ---
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Launch form state (persisted in localStorage) ---
  const [capital, setCapital] = useState(() => {
    if (typeof window === "undefined") return "1000";
    return window.localStorage.getItem("backtest_capital") ?? "1000";
  });
  const [model, setModel] = useState("gemma4:31b-cloud");
  const [cumulativeMode, setCumulativeMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("backtest_cumulative") === "true";
  });
  const [baseCapital, setBaseCapital] = useState(() => {
    if (typeof window === "undefined") return 0;
    return (
      Number.parseFloat(
        window.localStorage.getItem("backtest_baseCapital") ?? "0",
      ) || 0
    );
  });

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

  // --- Simulation state ---
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{
    week: number;
    total: number;
  } | null>(null);
  const [runStatus, setRunStatus] = useState("");

  // --- Detail view state ---
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [trades, setTrades] = useState<BacktestTradeRecord[]>([]);
  const [snapshots, setSnapshots] = useState<BacktestSnapshotRecord[]>([]);
  const [startValue, setStartValue] = useState(1000);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  // --- Help toggles ---
  const [helpOpen, setHelpOpen] = useState<Record<string, boolean>>({});
  const toggleHelp = (key: string) =>
    setHelpOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  // --- Live paper trading state ---
  const [liveResult, setLiveResult] = useState<LiveStepResponse | null>(null);
  const [isLiveRunning, setIsLiveRunning] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveHistory, setLiveHistory] = useState<LiveTradeHistoryItem[]>([]);

  // --- Data loaders ---

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

  const loadLiveHistory = useCallback(async () => {
    try {
      const state = await getLiveState();
      setLiveHistory(state.trades as LiveTradeHistoryItem[]);
    } catch {
      // No live state yet.
    }
  }, []);

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

  // --- Initial load ---
  const didInitialLoadRef = useRef(false);
  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    loadRuns();
    loadLiveHistory();
  }, [loadRuns, loadLiveHistory]);

  // --- Handlers ---

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
      if (cumulativeMode && baseCapital === 0) {
        setBaseCapital(capitalNum);
      }
      const startResp = await startRun({ model, capital: capitalNum });
      const { runId, totalWeeks } = startResp;

      setProgress({ week: 0, total: totalWeeks });

      for (let week = 1; week <= totalWeeks; week++) {
        setProgress({ week, total: totalWeeks });
        setRunStatus(`Неделя ${week}/${totalWeeks}…`);
        await runStepRequest(runId, week);
      }

      setRunStatus("Расчёт метрик…");
      const finishResp = await finishRun(runId);

      setSummary(finishResp.summary);
      setRunStatus("");

      if (cumulativeMode && finishResp.summary.endValue > 0) {
        setCapital(finishResp.summary.endValue.toFixed(2));
      }

      await loadRuns();
      await loadDetail(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setRunStatus("");
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }, [capital, model, cumulativeMode, baseCapital, loadRuns, loadDetail]);

  const handleLiveStep = useCallback(async () => {
    setIsLiveRunning(true);
    setLiveError(null);
    try {
      const result = await liveStep(model);
      setLiveResult(result);
      setCapital(result.totalValue.toFixed(2));
      if (baseCapital === 0) {
        setBaseCapital(result.startingCapital);
      }
      await loadLiveHistory();
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : "Live step failed");
    } finally {
      setIsLiveRunning(false);
    }
  }, [model, baseCapital, loadLiveHistory]);

  const handleLiveReset = useCallback(async () => {
    try {
      const capitalNum = Number.parseFloat(capital) || 1000;
      await resetLive(capitalNum);
      setLiveResult(null);
      setLiveError(null);
      setLiveHistory([]);
      setBaseCapital(capitalNum);
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : "Reset failed");
    }
  }, [capital]);

  const handleCumulativeChange = useCallback((checked: boolean) => {
    setCumulativeMode(checked);
    if (!checked) setBaseCapital(0);
  }, []);

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

  const showBank = (cumulativeMode || liveResult !== null) && baseCapital > 0;

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
      <LaunchFormMolecule
        capital={capital}
        setCapital={setCapital}
        model={model}
        setModel={setModel}
        cumulativeMode={cumulativeMode}
        setCumulativeMode={handleCumulativeChange}
        baseCapital={baseCapital}
        showBank={showBank}
        isRunning={isRunning}
        onLaunch={handleLaunch}
        progress={progress}
        runStatus={runStatus}
        helpOpen={helpOpen}
        toggleHelp={toggleHelp}
      />

      {/* Run detail */}
      {selectedRunId && summary && (
        <RunDetailMolecule
          runId={selectedRunId}
          summary={summary}
          trades={trades}
          snapshots={snapshots}
          startValue={startValue}
          helpOpen={helpOpen}
          toggleHelp={toggleHelp}
        />
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

      {/* Live paper trading */}
      <LiveTradingMolecule
        liveResult={liveResult}
        isLiveRunning={isLiveRunning}
        liveError={liveError}
        liveHistory={liveHistory}
        onStep={handleLiveStep}
        onReset={handleLiveReset}
        helpOpen={helpOpen}
        toggleHelp={toggleHelp}
      />

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
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                border: `1px solid ${
                  helpOpen["history"] ? colors.brand[500] : colors.neutral[300]
                }`,
                backgroundColor: helpOpen["history"]
                  ? colors.brand[50]
                  : colors.neutral[0],
                color: helpOpen["history"]
                  ? colors.brand[600]
                  : colors.neutral[500],
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.bold,
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
                fontFamily: typography.fontFamily.sans.join(", "),
                marginLeft: spacing[2],
                verticalAlign: "middle",
              }}
            >
              ?
            </button>
          </div>
          {helpOpen["history"] && (
            <div
              style={{
                backgroundColor: colors.info[50],
                border: `1px solid ${colors.info[100]}`,
                borderRadius: "0.5rem",
                padding: `${spacing[3]} ${spacing[4]}`,
                marginBottom: spacing[3],
                fontSize: typography.fontSize.xs,
                color: colors.neutral[600],
                fontFamily: typography.fontFamily.sans.join(", "),
                lineHeight: typography.lineHeight.normal,
              }}
            >
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
