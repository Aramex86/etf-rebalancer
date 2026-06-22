// src/features/predictions/api/verify.ts

/** Response shape from POST /api/predictions/verify. */
export interface VerifyResponse {
  /** Number of predictions successfully verified. */
  verified: number;
  /** Direction accuracy (0-1) for this batch. */
  accuracy: number;
  /** Average MAPE for this batch. */
  avgMape: number;
  /** Number of correct direction predictions. */
  directionCorrect: number;
  /** Total predictions in the batch. */
  total: number;
  /** Optional message (e.g. "No unverified predictions found"). */
  message?: string;
}

/**
 * Verify unverified predictions against actual prices.
 * Calls POST /api/predictions/verify.
 */
export async function verifyPredictions(): Promise<VerifyResponse> {
  const response = await fetch("/api/predictions/verify", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to verify predictions");
  }

  return response.json();
}
