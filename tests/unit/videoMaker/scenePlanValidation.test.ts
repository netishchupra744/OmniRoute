import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScenePlanRepairInstruction,
  validateScenePlan,
} from "../../../src/domain/videoMaker/scenePlanValidation.ts";
import { makeScenePlan } from "./fixtures.ts";

test("accepts exactly 33 connected ten-second scenes", () => {
  const result = validateScenePlan(makeScenePlan());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.totalDurationSeconds, 330);
  assert.deepEqual(result.errors, []);
});

test("rejects duplicate dialogue, wrong duration and missing scene number", () => {
  const scenes = makeScenePlan();
  scenes[1].exactDialogue = scenes[0].exactDialogue;
  scenes[2].durationSeconds = 8;
  scenes[3].sceneNumber = 8;

  const result = validateScenePlan(scenes);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /duplicate exactDialogue/i);
  assert.match(result.errors.join("\n"), /durationSeconds must equal 10/i);
  assert.match(result.errors.join("\n"), /Missing sceneNumber 4/i);
  assert.match(buildScenePlanRepairInstruction(result), /return JSON only/i);
});

test("never silently accepts malformed non-array output", () => {
  const result = validateScenePlan({ scenes: makeScenePlan() });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ["Scene plan must be a JSON array."]);
});
