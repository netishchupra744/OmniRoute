import assert from "node:assert/strict";
import test from "node:test";
import { compileScenePrompt } from "../../../src/domain/videoMaker/promptCompiler.ts";
import { avatar, makeScenePlan, masterPrompt, settings } from "./fixtures.ts";

test("compiles a self-contained exact ten-second scene prompt", () => {
  const scene = makeScenePlan()[0];
  const prompt = compileScenePrompt({ master: masterPrompt, avatar, settings, scene });

  assert.match(prompt, /SELF-CONTAINED SCENE 1/);
  assert.match(prompt, /exactly 10\.0 seconds/);
  assert.match(prompt, /16:9/);
  assert.match(prompt, /1920×1080/);
  assert.match(prompt, new RegExp(scene.exactDialogue));
  assert.match(prompt, /asset-front-001/);
  assert.match(prompt, /No extra dialogue/);
  assert.doesNotMatch(prompt, /^use the master prompt$/im);
});

test("rejects a scene duration that differs from the project", () => {
  const scene = makeScenePlan()[0];
  scene.durationSeconds = 9;
  assert.throws(
    () => compileScenePrompt({ master: masterPrompt, avatar, settings, scene }),
    /does not match project duration/
  );
});
