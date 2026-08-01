import type { RetryDecision, RetryErrorKind } from "./types.ts";

const TRANSIENT_ERRORS = new Set<RetryErrorKind>([
  "NETWORK",
  "TIMEOUT",
  "RATE_LIMIT",
  "PROVIDER_5XX",
  "UNKNOWN",
]);

const USER_ACTION_ERRORS = new Set<RetryErrorKind>([
  "AUTHENTICATION",
  "VALIDATION",
  "UNSUPPORTED_CAPABILITY",
  "QUOTA_EXHAUSTED",
  "CANCELLED",
]);

export interface RetryPolicyInput {
  errorKind: RetryErrorKind;
  attemptCount: number;
  maximumAttempts?: number;
  baseDelayMs?: number;
  compatibleFallbackAvailable?: boolean;
}

export function decideRetry(input: RetryPolicyInput): RetryDecision {
  const maximumAttempts = input.maximumAttempts ?? 3;
  const baseDelayMs = input.baseDelayMs ?? 2_000;

  if (!Number.isInteger(input.attemptCount) || input.attemptCount < 1) {
    throw new RangeError("attemptCount must be a positive integer");
  }
  if (USER_ACTION_ERRORS.has(input.errorKind)) {
    return {
      retry: false,
      delayMs: 0,
      useFallbackProvider: false,
      reason: `Automatic retry is disabled for ${input.errorKind}; user action is required.`,
    };
  }
  if (!TRANSIENT_ERRORS.has(input.errorKind)) {
    return {
      retry: false,
      delayMs: 0,
      useFallbackProvider: false,
      reason: `Error ${input.errorKind} is not classified as transient.`,
    };
  }
  if (input.attemptCount >= maximumAttempts) {
    return {
      retry: false,
      delayMs: 0,
      useFallbackProvider: false,
      reason: `Maximum attempt count (${maximumAttempts}) reached.`,
    };
  }

  const delayMs = Math.min(
    60_000,
    baseDelayMs * 2 ** Math.max(0, input.attemptCount - 1)
  );
  const useFallbackProvider =
    input.attemptCount >= 2 && input.compatibleFallbackAvailable === true;

  return {
    retry: true,
    delayMs,
    useFallbackProvider,
    reason: useFallbackProvider
      ? "Retry with a capability-compatible fallback provider after exponential backoff."
      : "Retry with the same provider after exponential backoff.",
  };
}
