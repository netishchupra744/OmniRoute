import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProjectTransition,
  assertSceneTransition,
  canTransitionProject,
  canTransitionScene,
} from "../../../src/domain/videoMaker/jobStateMachine.ts";

test("allows the normal persistent scene job lifecycle", () => {
  assert.equal(canTransitionScene("QUEUED", "SUBMITTING"), true);
  assert.equal(canTransitionScene("SUBMITTING", "PROCESSING"), true);
  assert.equal(canTransitionScene("PROCESSING", "DOWNLOADING"), true);
  assert.equal(canTransitionScene("DOWNLOADING", "COMPLETED"), true);
  assert.doesNotThrow(() => assertSceneTransition("FAILED", "RETRYING"));
});

test("blocks an impossible scene transition", () => {
  assert.equal(canTransitionScene("DRAFT", "COMPLETED"), false);
  assert.throws(() => assertSceneTransition("DRAFT", "COMPLETED"), /Illegal scene status transition/);
});

test("allows project generation and render lifecycle", () => {
  assert.equal(canTransitionProject("PLAN_READY", "GENERATING"), true);
  assert.equal(canTransitionProject("GENERATING", "READY_TO_RENDER"), true);
  assert.equal(canTransitionProject("READY_TO_RENDER", "RENDERING"), true);
  assert.doesNotThrow(() => assertProjectTransition("RENDERING", "COMPLETED"));
});
