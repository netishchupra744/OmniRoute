import test from "node:test";
import assert from "node:assert/strict";
import {
  generateValidatedMasterPrompt,
  MasterPromptGenerationError,
} from "../../../src/domain/videoMaker/masterPromptGenerator.ts";
import type { MasterPromptIdentityRules } from "../../../src/domain/videoMaker/types.ts";

const valid: MasterPromptIdentityRules = {
  videoObjective: "Teach the workflow",
  targetAudience: "Bangla YouTube creators",
  presenterIdentity: "Same uploaded presenter",
  referenceImageRules: "Use all supplied references",
  faceConsistency: "Preserve exact facial identity",
  hairstyle: "Preserve exact hairstyle",
  beard: "Preserve exact beard",
  skinTone: "Preserve exact skin tone",
  bodyProportions: "Preserve exact proportions",
  clothing: "Black jacket and dark shirt",
  studio: "Dark navy technology studio",
  lighting: "Cyan and purple cinematic lighting",
  cameraLanguage: "Stable presenter coverage",
  movementRules: "Natural blinking, breathing and gestures",
  voiceRequirements: "Natural Bangla male voice",
  lipSyncRequirements: "Accurate Bangla lip sync",
  musicStyle: "Low electronic underscore",
  soundEffectStyle: "Clean restrained transitions",
  textOverlayRules: "Only requested short labels",
  sceneContinuity: "Continue position and motion between scenes",
  negativeConstraints: ["No identity drift", "No premature ending"],
};

test("repairs invalid Master Prompt JSON and returns the validated object", async () => {
  const prompts: string[] = [];
  const result = await generateValidatedMasterPrompt({
    initialPrompt: "create",
    invokeLlm: async (prompt, attempt) => {
      prompts.push(prompt);
      return attempt === 1 ? "not json" : JSON.stringify(valid);
    },
  });
  assert.equal(result.presenterIdentity, valid.presenterIdentity);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Repair the master-prompt JSON/);
});

test("throws with attempt history when Master Prompt remains malformed", async () => {
  await assert.rejects(
    () =>
      generateValidatedMasterPrompt({
        initialPrompt: "create",
        maximumAttempts: 2,
        invokeLlm: async () => "{}",
      }),
    (error: unknown) => {
      assert.ok(error instanceof MasterPromptGenerationError);
      assert.equal(error.attempts.length, 2);
      return true;
    }
  );
});
