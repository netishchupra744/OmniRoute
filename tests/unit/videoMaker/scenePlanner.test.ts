import assert from "node:assert/strict";
import test from "node:test";
import {
  generateValidatedScenePlan,
  ScenePlanGenerationError,
} from "../../../src/domain/videoMaker/scenePlanner.ts";
import { makeScenePlan } from "./fixtures.ts";

test("automatically repairs an invalid scene plan and returns only a valid plan", async () => {
  const prompts: string[] = [];
  const invalid = makeScenePlan(32);
  const valid = makeScenePlan();

  const result = await generateValidatedScenePlan({
    initialPrompt: "Create 33 scenes",
    invokeLlm: async (prompt, attempt) => {
      prompts.push(prompt);
      return JSON.stringify(attempt === 1 ? invalid : valid);
    },
  });

  assert.equal(result.length, 33);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Repair the scene-plan JSON/);
  assert.match(prompts[1], /Expected exactly 33 scenes/);
});

test("throws with attempt history instead of saving permanently malformed output", async () => {
  await assert.rejects(
    () =>
      generateValidatedScenePlan({
        initialPrompt: "Create 33 scenes",
        maximumAttempts: 2,
        invokeLlm: async () => "```json\n[]\n```",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ScenePlanGenerationError);
      assert.equal(error.attempts.length, 2);
      assert.equal(error.attempts[0].parsed, false);
      return true;
    }
  );
});
