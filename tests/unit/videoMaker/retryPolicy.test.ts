import assert from "node:assert/strict";
import test from "node:test";
import { decideRetry } from "../../../src/domain/videoMaker/retryPolicy.ts";

test("retries the first transient failure with the same provider", () => {
  const decision = decideRetry({ errorKind: "TIMEOUT", attemptCount: 1 });
  assert.equal(decision.retry, true);
  assert.equal(decision.delayMs, 2_000);
  assert.equal(decision.useFallbackProvider, false);
});

test("uses compatible fallback only on a later retry", () => {
  const decision = decideRetry({
    errorKind: "RATE_LIMIT",
    attemptCount: 2,
    compatibleFallbackAvailable: true,
  });
  assert.equal(decision.retry, true);
  assert.equal(decision.delayMs, 4_000);
  assert.equal(decision.useFallbackProvider, true);
});

test("does not retry permanent authentication or validation failures", () => {
  assert.equal(decideRetry({ errorKind: "AUTHENTICATION", attemptCount: 1 }).retry, false);
  assert.equal(decideRetry({ errorKind: "VALIDATION", attemptCount: 1 }).retry, false);
});

test("stops after the third attempt", () => {
  const decision = decideRetry({ errorKind: "PROVIDER_5XX", attemptCount: 3 });
  assert.equal(decision.retry, false);
  assert.match(decision.reason, /Maximum attempt count/);
});
