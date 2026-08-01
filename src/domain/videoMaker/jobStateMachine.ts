import type { SceneStatus, VideoProjectStatus } from "./types.ts";

const SCENE_TRANSITIONS: Record<SceneStatus, ReadonlySet<SceneStatus>> = {
  DRAFT: new Set(["PROMPT_READY", "CANCELLED"]),
  PROMPT_READY: new Set(["QUEUED", "DRAFT", "CANCELLED"]),
  QUEUED: new Set(["SUBMITTING", "CANCELLED", "FAILED"]),
  SUBMITTING: new Set(["PROCESSING", "COMPLETED", "RETRYING", "FAILED", "CANCELLED"]),
  PROCESSING: new Set(["DOWNLOADING", "COMPLETED", "RETRYING", "FAILED", "CANCELLED"]),
  DOWNLOADING: new Set(["COMPLETED", "RETRYING", "FAILED", "CANCELLED"]),
  COMPLETED: new Set(["QUEUED"]),
  RETRYING: new Set(["QUEUED", "SUBMITTING", "FAILED", "CANCELLED"]),
  FAILED: new Set(["RETRYING", "QUEUED", "CANCELLED"]),
  CANCELLED: new Set(["QUEUED"]),
};

const PROJECT_TRANSITIONS: Record<VideoProjectStatus, ReadonlySet<VideoProjectStatus>> = {
  DRAFT: new Set(["PLANNING", "CANCELLED"]),
  PLANNING: new Set(["PLAN_READY", "FAILED", "CANCELLED"]),
  PLAN_READY: new Set(["GENERATING", "PLANNING", "CANCELLED"]),
  GENERATING: new Set([
    "PARTIALLY_COMPLETED",
    "READY_TO_RENDER",
    "FAILED",
    "CANCELLED",
  ]),
  PARTIALLY_COMPLETED: new Set(["GENERATING", "READY_TO_RENDER", "FAILED", "CANCELLED"]),
  READY_TO_RENDER: new Set(["RENDERING", "GENERATING", "CANCELLED"]),
  RENDERING: new Set(["COMPLETED", "FAILED", "CANCELLED"]),
  COMPLETED: new Set(["RENDERING"]),
  FAILED: new Set(["PLANNING", "GENERATING", "RENDERING", "CANCELLED"]),
  CANCELLED: new Set(["DRAFT", "GENERATING"]),
};

export function canTransitionScene(from: SceneStatus, to: SceneStatus): boolean {
  return from === to || SCENE_TRANSITIONS[from].has(to);
}

export function assertSceneTransition(from: SceneStatus, to: SceneStatus): void {
  if (!canTransitionScene(from, to)) {
    throw new Error(`Illegal scene status transition: ${from} -> ${to}`);
  }
}

export function canTransitionProject(
  from: VideoProjectStatus,
  to: VideoProjectStatus
): boolean {
  return from === to || PROJECT_TRANSITIONS[from].has(to);
}

export function assertProjectTransition(
  from: VideoProjectStatus,
  to: VideoProjectStatus
): void {
  if (!canTransitionProject(from, to)) {
    throw new Error(`Illegal project status transition: ${from} -> ${to}`);
  }
}
