"use client";

import { useEffect, useState } from "react";
import { AIExplanationMolecule } from "@/shared/molecules/AIExplanationMolecule";
import { fetchExplanation } from "../api/explain";
import { ParsedPortfolio } from "@/entities/portfolio";

export interface AIExplanationFeatureProps {
  amount: number;
  trigger?: number;
  portfolio?: ParsedPortfolio | null;
}

export function AIExplanationFeature({
  amount,
  trigger,
  portfolio,
}: AIExplanationFeatureProps) {
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (trigger === undefined || trigger === 0) return;

    let cancelled = false;

    // Defer setState to avoid synchronous call in effect body.
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });

    fetchExplanation({ amount, portfolio })
      .then((text) => {
        if (!cancelled) setExplanation(text);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setExplanation("⚠️ Ошибка при получении объяснения");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [amount, trigger, portfolio]);

  return (
    <div style={{ width: "100%", minWidth: "0" }}>
      <AIExplanationMolecule
        explanation={
          explanation || "Нажмите «Рассчитать», чтобы получить AI-объяснение"
        }
        loading={loading}
      />
    </div>
  );
}
