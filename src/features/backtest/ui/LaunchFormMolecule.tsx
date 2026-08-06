// src/features/backtest/ui/LaunchFormMolecule.tsx

"use client";

import { colors, spacing, typography } from "@/shared/ui/tokens";
import { shadows } from "@/shared/ui/tokens/spacing";
import { useIsMobile } from "@/shared/lib/useMediaQuery";
import { BankPanelMolecule } from "./BankPanelMolecule";

interface LaunchFormMoleculeProps {
  capital: string;
  setCapital: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  cumulativeMode: boolean;
  setCumulativeMode: (v: boolean) => void;
  baseCapital: number;
  showBank: boolean;
  isRunning: boolean;
  onLaunch: () => void;
  progress: { week: number; total: number } | null;
  runStatus: string;
  helpOpen: Record<string, boolean>;
  toggleHelp: (key: string) => void;
}

/**
 * Launch form card — capital input, model selector, cumulative mode,
 * run button, progress bar, help panel.
 */
export function LaunchFormMolecule({
  capital,
  setCapital,
  model,
  setModel,
  cumulativeMode,
  setCumulativeMode,
  baseCapital,
  showBank,
  isRunning,
  onLaunch,
  progress,
  runStatus,
  helpOpen,
  toggleHelp,
}: LaunchFormMoleculeProps) {
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

  const currentCapital = Number.parseFloat(capital) || 0;

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
        LLM-агент торгует UCITS ETF на исторических данных (3 года). Покупает на
        просадках, продаёт на росте. Прибыль реинвестируется. Сравнение со
        стратегией Buy &amp; Hold.
      </div>
      {helpOpen["launch"] && (
        <div style={helpPanelStyle}>
          <strong>Стартовый капитал</strong> — сумма ($), с которой агент
          начинает торговлю.
          <br />
          <strong>Накопительный режим</strong> — если включён, после завершения
          прогона стартовый капитал следующего автоматически становится равным
          конечному капиталу предыдущего. Так агент продолжает торговать с
          накопленным результатом — задача приумножить капитал через несколько
          прогонов.
          <br />
          <strong>Модель LLM</strong> — какая Ollama-модель принимает решения
          (gemma4:31b-cloud, qwen3:480b и др.).
          <br />
          <strong>Параметры симуляции:</strong> 3 года истории цен, недельные
          шаги (~156 недель), макс 3 одновременные позиции, до 50% кэша на одну
          позицию, минимальная сделка $50, комиссия $1 + 0.05% спред, налог 12%
          на реализованную прибыль.
        </div>
      )}

      {showBank && (
        <BankPanelMolecule
          currentCapital={currentCapital}
          baseCapital={baseCapital}
        />
      )}

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
                  // parent handles baseCapital reset via callback
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
          onClick={onLaunch}
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
  );
}
