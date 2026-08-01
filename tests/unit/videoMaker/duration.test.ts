import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBijoyDefaultDuration,
  calculateFinalDurationSeconds,
  EXPECTED_FINAL_DURATION_SECONDS,
} from "../../../src/domain/videoMaker/duration.ts";

test("calculates 33 × 10 as exactly 330 seconds", () => {
  assert.equal(calculateFinalDurationSeconds(33, 10), 330);
  assert.equal(EXPECTED_FINAL_DURATION_SECONDS, 330);
  assert.doesNotThrow(() => assertBijoyDefaultDuration(33, 10));
});

test("rejects a non-default Bijoy timeline", () => {
  assert.throws(() => assertBijoyDefaultDuration(32, 10), /must be 33 scenes/);
});
