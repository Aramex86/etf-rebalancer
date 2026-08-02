// src/features/backtest/api/backtestApi.ts

"use client";

import type {
  StartRunRequest,
  StartRunResponse,
  StepResponse,
  FinishRunResponse,
  RunListItem,
  RunDetailResponse,
} from "@/entities/backtest";

/**
 * Start a new backtest run.
 * POST /api/backtest/start
 */
export async function startRun(
  req: StartRunRequest,
): Promise<StartRunResponse> {
  const res = await fetch("/api/backtest/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Execute a single simulation step.
 * POST /api/backtest/step?runId=xxx&week=N
 */
export async function runStepRequest(
  runId: string,
  week: number,
): Promise<StepResponse> {
  const res = await fetch(
    `/api/backtest/step?runId=${encodeURIComponent(runId)}&week=${week}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Finish a run — calculate final metrics and mark as done.
 * POST /api/backtest/finish?runId=xxx
 */
export async function finishRun(runId: string): Promise<FinishRunResponse> {
  const res = await fetch(
    `/api/backtest/finish?runId=${encodeURIComponent(runId)}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * List all backtest runs.
 * GET /api/backtest/runs
 */
export async function listRuns(): Promise<RunListItem[]> {
  const res = await fetch("/api/backtest/runs");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.runs as RunListItem[];
}

/**
 * Get full details for a single run.
 * GET /api/backtest/runs?runId=xxx
 */
export async function getRunDetail(runId: string): Promise<RunDetailResponse> {
  const res = await fetch(
    `/api/backtest/runs?runId=${encodeURIComponent(runId)}`,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Delete a run and all its data.
 * DELETE /api/backtest/runs?runId=xxx
 */
export async function deleteRun(runId: string): Promise<void> {
  const res = await fetch(
    `/api/backtest/runs?runId=${encodeURIComponent(runId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}
