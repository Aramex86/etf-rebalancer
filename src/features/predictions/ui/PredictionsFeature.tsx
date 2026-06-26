// src/features/predictions/ui/PredictionsFeature.tsx

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colors, spacing, typography } from "@/shared/ui/tokens";
import { useIsMobile } from "@/shared/lib/useMediaQuery";
import {
  fetchPredictions,
  createPredictions,
  type PredictionWithAccuracy,
} from "../api/predictions";
import { verifyPredictions, type VerifyResponse } from "../api/verify";
import { PredictionHeaderMolecule } from "./PredictionHeaderMolecule";
import { PredictionTableMolecule } from "./PredictionTableMolecule";
import { PredictionCardMolecule } from "./PredictionCardMolecule";

/**
 * Full predictions feature: header + table (desktop) / cards (mobile).
 * Loads predictions on mount, supports generate and verify actions.
 */
export function PredictionsFeature() {
  const isMobile = useIsMobile();
  const [predictions, setPredictions] = useState<PredictionWithAccuracy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);

  // Guard against double-fetch in dev (React 19 StrictMode, fast refresh,
  // and route re-mounts can all cause useEffect to fire 2-3 times).
  const didInitialLoadRef = useRef(false);

  /** Load latest predictions from GET /api/predictions. */
  const loadPredictions = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchPredictions(50);
      setPredictions(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load predictions",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Run the initial fetch exactly once, even if the effect re-fires.
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    loadPredictions();
  }, [loadPredictions]);

  /** Generate new predictions via POST /api/predictions. */
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setVerifyResult(null);
    try {
      await createPredictions();
      await loadPredictions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate predictions",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [loadPredictions]);

  /** Verify predictions via POST /api/predictions/verify. */
  const handleVerify = useCallback(async () => {
    setIsVerifying(true);
    setError(null);
    try {
      const result = await verifyPredictions();
      setVerifyResult(result);
      await loadPredictions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to verify predictions",
      );
    } finally {
      setIsVerifying(false);
    }
  }, [loadPredictions]);

  // --- Loading state ---
  if (isLoading) {
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
        ⏳ Загрузка прогнозов…
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <PredictionHeaderMolecule
        isGenerating={isGenerating}
        isVerifying={isVerifying}
        onGenerate={handleGenerate}
        onVerify={handleVerify}
      />

      {/* Error banner */}
      {error && (
        <div
          style={{
            backgroundColor: colors.danger[50],
            border: `1px solid ${colors.danger[200]}`,
            borderRadius: "0.5rem",
            padding: `${spacing[3]} ${spacing[4]}`,
            marginBottom: spacing[4],
            fontSize: typography.fontSize.sm,
            color: colors.danger[700],
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* Verify result banner */}
      {verifyResult && (
        <div
          style={{
            backgroundColor: colors.info[50],
            border: `1px solid ${colors.info[100]}`,
            borderRadius: "0.5rem",
            padding: `${spacing[3]} ${spacing[4]}`,
            marginBottom: spacing[4],
            fontSize: typography.fontSize.sm,
            color: colors.info[700],
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          {verifyResult.total === 0
            ? "ℹ️ Нет прогнозов для проверки — все уже верифицированы."
            : `✅ Проверено: ${verifyResult.verified} из ${verifyResult.total}. Точность направления: ${(verifyResult.accuracy * 100).toFixed(0)}%. Средний MAPE: ${verifyResult.avgMape.toFixed(2)}%.`}
        </div>
      )}

      {/* Empty state */}
      {predictions.length === 0 && !error ? (
        <div
          style={{
            padding: spacing[8],
            textAlign: "center",
            color: colors.neutral[500],
            fontSize: typography.fontSize.base,
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          📭 Прогнозов пока нет. Нажмите «Обновить прогнозы» для генерации.
        </div>
      ) : (
        renderPredictions()
      )}
    </div>
  );

  /** Render table (desktop) or cards (mobile). */
  function renderPredictions() {
    if (isMobile) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacing[3],
          }}
        >
          {predictions.map((pred) => (
            <PredictionCardMolecule key={pred.id} prediction={pred} />
          ))}
        </div>
      );
    }
    return <PredictionTableMolecule predictions={predictions} />;
  }
}
