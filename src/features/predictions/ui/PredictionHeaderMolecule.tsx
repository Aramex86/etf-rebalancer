// src/features/predictions/ui/PredictionHeaderMolecule.tsx

"use client";

import { useState } from "react";
import { ButtonAtom } from "@/shared/atoms/ButtonAtom";
import { colors, spacing, typography } from "@/shared/ui/tokens";

export interface PredictionHeaderMoleculeProps {
  /** True while POST /api/predictions is running. */
  isGenerating: boolean;
  /** True while POST /api/predictions/verify is running. */
  isVerifying: boolean;
  /** Called when user clicks "Обновить прогнозы". */
  onGenerate: () => void;
  /** Called when user clicks "Проверить прогнозы". */
  onVerify: () => void;
}

/** Help items explaining each table column. */
const HELP_ITEMS: Array<{ icon: string; title: string; text: string }> = [
  {
    icon: "📊",
    title: "Символ",
    text: "Тикер ETF (например, SWRD). Кликните на заголовок колонки для сортировки.",
  },
  {
    icon: "💲",
    title: "Текущая цена",
    text: "Последняя цена закрытия из Yahoo Finance. Валюта ($ или €) берётся из watchlist.",
  },
  {
    icon: "🔮",
    title: "Прогноз (7д)",
    text: "Предсказанная цена через 7 дней от LLM-модели на основе 30-дневной истории и индикаторов (SMA7, SMA14, волатильность).",
  },
  {
    icon: "📈",
    title: "Изм. %",
    text: "Ожидаемое изменение цены в %: (прогноз − текущая) / текущая × 100. Зелёный — рост, красный — падение.",
  },
  {
    icon: "💰",
    title: "After-tax %",
    text: "Доходность после налогов Молдовы: 12% на прирост капитала + 15% удержания для распределяющих ETF. Главная колонка для принятия решений.",
  },
  {
    icon: "🚦",
    title: "Сигнал",
    text: "Купить (зелёный) — after-tax ≥ +2%. Продать (красный) — after-tax ≤ −2%. Подождать (жёлтый) — между порогами. Пороги настраиваются через env vars.",
  },
  {
    icon: "🎯",
    title: "Confidence",
    text: "Уверенность модели в прогнозе (0–100%). Зависит от величины ожидаемого изменения и волатильности.",
  },
  {
    icon: "✅",
    title: "Точность",
    text: "Доля верно угаданных направлений (вверх/вниз) по прошлым прогнозам этого ETF. Зелёный > 60%, жёлтый 50–60%, красный < 50%. «—» — ещё нет проверенных прогнозов.",
  },
  {
    icon: "📝",
    title: "Обоснование",
    text: "Кликните «Показать» чтобы развернуть рассуждения LLM — почему именно такой прогноз. Включает анализ тренда, индикаторов и рыночного контекста.",
  },
];

/** Workflow steps. */
const WORKFLOW_STEPS: Array<{ step: string; text: string }> = [
  {
    step: "1️⃣",
    text: "Нажмите «Обновить прогнозы» — агент скачает цены с Yahoo Finance, вычислит индикаторы и запросит прогноз у LLM.",
  },
  {
    step: "2️⃣",
    text: "Изучите таблицу: отсортируйте по After-tax % (клик на заголовок) чтобы увидеть самые перспективные ETF сверху.",
  },
  {
    step: "3️⃣",
    text: "Сигнал «Купить» не означает «покупай всё» — учитывайте ваш target allocation и текущие отклонения портфеля.",
  },
  {
    step: "4️⃣",
    text: "Через 7 дней нажмите «Проверить прогнозы» — система сравнит прогнозы с реальными ценами и посчитает точность.",
  },
];

/**
 * Header for the predictions section.
 * Contains title, action buttons, a disclaimer banner, and a collapsible help panel.
 */
export function PredictionHeaderMolecule({
  isGenerating,
  isVerifying,
  onGenerate,
  onVerify,
}: PredictionHeaderMoleculeProps) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div style={{ marginBottom: spacing[6] }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: spacing[4],
          marginBottom: spacing[4],
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
          <h2
            style={{
              fontSize: typography.fontSize["2xl"],
              fontWeight: typography.fontWeight.bold,
              color: colors.neutral[900],
              margin: 0,
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            📈 Прогнозы UCITS ETF
          </h2>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-label="Как читать таблицу"
            title="Как читать таблицу"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              border: `1px solid ${showHelp ? colors.brand[500] : colors.neutral[300]}`,
              backgroundColor: showHelp ? colors.brand[50] : colors.neutral[0],
              color: showHelp ? colors.brand[600] : colors.neutral[500],
              fontSize: typography.fontSize.base,
              fontWeight: typography.fontWeight.bold,
              cursor: "pointer",
              transition: "all 0.15s ease",
              fontFamily: typography.fontFamily.sans.join(", "),
              padding: 0,
              lineHeight: 1,
            }}
          >
            ?
          </button>
        </div>

        <div style={{ display: "flex", gap: spacing[3], flexWrap: "wrap" }}>
          <ButtonAtom
            variant="primary"
            size="md"
            disabled={isGenerating || isVerifying}
            onClick={onGenerate}
          >
            {isGenerating ? "⏳ Генерация…" : "🔄 Обновить прогнозы"}
          </ButtonAtom>
          <ButtonAtom
            variant="secondary"
            size="md"
            disabled={isGenerating || isVerifying}
            onClick={onVerify}
          >
            {isVerifying ? "⏳ Проверка…" : "✅ Проверить прогнозы"}
          </ButtonAtom>
        </div>
      </div>

      {/* Collapsible help panel */}
      {showHelp && (
        <div
          style={{
            backgroundColor: colors.info[50],
            border: `1px solid ${colors.info[100]}`,
            borderRadius: "0.5rem",
            padding: `${spacing[4]} ${spacing[5]}`,
            marginBottom: spacing[4],
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          <h3
            style={{
              fontSize: typography.fontSize.base,
              fontWeight: typography.fontWeight.semibold,
              color: colors.info[700],
              margin: `0 0 ${spacing[3]} 0`,
            }}
          >
            📖 Как читать таблицу прогнозов
          </h3>

          {/* Column explanations */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: spacing[3],
              marginBottom: spacing[4],
            }}
          >
            {HELP_ITEMS.map((item) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  gap: spacing[2],
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{ fontSize: typography.fontSize.lg, flexShrink: 0 }}
                >
                  {item.icon}
                </span>
                <div>
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.neutral[800],
                    }}
                  >
                    {item.title}
                  </span>
                  <p
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.neutral[600],
                      margin: `${spacing[1]} 0 0 0`,
                      lineHeight: typography.lineHeight.normal,
                    }}
                  >
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Workflow steps */}
          <div
            style={{
              borderTop: `1px solid ${colors.info[100]}`,
              paddingTop: spacing[3],
            }}
          >
            <h4
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: colors.info[700],
                margin: `0 0 ${spacing[2]} 0`,
              }}
            >
              🔄 Как пользоваться
            </h4>
            {WORKFLOW_STEPS.map((s, i) => (
              <p
                key={i}
                style={{
                  fontSize: typography.fontSize.xs,
                  color: colors.neutral[600],
                  margin: `${spacing[1]} 0`,
                  lineHeight: typography.lineHeight.normal,
                }}
              >
                {s.step} {s.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer banner */}
      <div
        style={{
          backgroundColor: colors.warning[50],
          border: `1px solid ${colors.warning[200]}`,
          borderRadius: "0.5rem",
          padding: `${spacing[3]} ${spacing[4]}`,
          fontSize: typography.fontSize.sm,
          color: colors.warning[800],
          fontFamily: typography.fontFamily.sans.join(", "),
          lineHeight: typography.lineHeight.normal,
        }}
      >
        ⚠️ Прогнозы носят вероятностный характер, не являются инвестиционной
        рекомендацией. Горизонт — 7 дней. Учитывается налог Молдовы (12% на
        прирост капитала).
      </div>
    </div>
  );
}
