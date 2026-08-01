import assert from "node:assert/strict";
import test from "node:test";
import { buildFinalRenderTimeline } from "../../../src/domain/videoMaker/renderTimeline.ts";

function makeCompletedScenes() {
  return Array.from({ length: 33 }, (_, index) => ({
    sceneNumber: index + 1,
    status: "COMPLETED",
    durationSeconds: 10,
    source: {
      type: "url" as const,
      value: `https://media.example.test/scene-${index + 1}.mp4`,
    },
  }));
}

test("builds an ordered 330-second cloud render timeline", () => {
  const scenes = makeCompletedScenes().reverse();
  const timeline = buildFinalRenderTimeline(scenes);
  assert.equal(timeline.clips.length, 33);
  assert.equal(timeline.clips[0].sceneNumber, 1);
  assert.equal(timeline.clips[32].startSeconds, 320);
  assert.equal(timeline.totalDurationSeconds, 330);
  assert.equal(timeline.format, "mp4");
});

test("rejects incomplete or non-ten-second scenes", () => {
  const scenes = makeCompletedScenes();
  scenes[5].status = "FAILED";
  assert.throws(() => buildFinalRenderTimeline(scenes), /not completed/);

  scenes[5].status = "COMPLETED";
  scenes[5].durationSeconds = 9;
  assert.throws(() => buildFinalRenderTimeline(scenes), /exactly 10 seconds/);
});
