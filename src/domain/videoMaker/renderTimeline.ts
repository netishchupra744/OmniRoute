import {
  DEFAULT_SCENE_COUNT,
  DEFAULT_SCENE_DURATION_SECONDS,
  EXPECTED_FINAL_DURATION_SECONDS,
} from "./duration.ts";

export interface RenderSceneSource {
  type: "url" | "storage";
  value: string;
}

export interface CompletedRenderScene {
  sceneNumber: number;
  status: "COMPLETED" | string;
  durationSeconds: number;
  source: RenderSceneSource;
}

export interface RenderTimelineClip {
  sceneNumber: number;
  source: RenderSceneSource;
  startSeconds: number;
  durationSeconds: number;
}

export interface FinalRenderTimeline {
  clips: RenderTimelineClip[];
  totalDurationSeconds: number;
  aspectRatio: "16:9";
  width: 1920;
  height: 1080;
  format: "mp4";
}

export function buildFinalRenderTimeline(
  scenes: CompletedRenderScene[]
): FinalRenderTimeline {
  if (scenes.length !== DEFAULT_SCENE_COUNT) {
    throw new Error(`Final render requires exactly ${DEFAULT_SCENE_COUNT} scenes.`);
  }

  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const seen = new Set<number>();

  const clips = ordered.map((scene, index): RenderTimelineClip => {
    const expectedSceneNumber = index + 1;
    if (!Number.isInteger(scene.sceneNumber) || scene.sceneNumber !== expectedSceneNumber) {
      throw new Error(
        `Final render scene order must be 1-${DEFAULT_SCENE_COUNT}; expected ${expectedSceneNumber}, received ${scene.sceneNumber}.`
      );
    }
    if (seen.has(scene.sceneNumber)) {
      throw new Error(`Duplicate final render sceneNumber ${scene.sceneNumber}.`);
    }
    seen.add(scene.sceneNumber);
    if (scene.status !== "COMPLETED") {
      throw new Error(`Scene ${scene.sceneNumber} is not completed.`);
    }
    if (scene.durationSeconds !== DEFAULT_SCENE_DURATION_SECONDS) {
      throw new Error(`Scene ${scene.sceneNumber} must be exactly 10 seconds.`);
    }
    if (!scene.source.value.trim()) {
      throw new Error(`Scene ${scene.sceneNumber} has no render source.`);
    }
    if (scene.source.type === "url") {
      const parsed = new URL(scene.source.value);
      if (parsed.protocol !== "https:") {
        throw new Error(`Scene ${scene.sceneNumber} remote render URL must use HTTPS.`);
      }
    }

    return {
      sceneNumber: scene.sceneNumber,
      source: scene.source,
      startSeconds: index * DEFAULT_SCENE_DURATION_SECONDS,
      durationSeconds: DEFAULT_SCENE_DURATION_SECONDS,
    };
  });

  const totalDurationSeconds = clips.reduce(
    (total, clip) => total + clip.durationSeconds,
    0
  );
  if (totalDurationSeconds !== EXPECTED_FINAL_DURATION_SECONDS) {
    throw new Error(
      `Final render timeline must equal ${EXPECTED_FINAL_DURATION_SECONDS} seconds; received ${totalDurationSeconds}.`
    );
  }

  return {
    clips,
    totalDurationSeconds,
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    format: "mp4",
  };
}
