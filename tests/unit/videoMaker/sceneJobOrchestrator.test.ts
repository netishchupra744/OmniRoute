import test from "node:test";
import assert from "node:assert/strict";
import { advanceSceneGenerationJob, type OrchestratedSceneJob, type SceneJobStore, type SceneVideoProviderAdapter } from "../../../src/lib/videoMaker/sceneJobOrchestrator.ts";

function createStore(initial: OrchestratedSceneJob): SceneJobStore & { current: OrchestratedSceneJob } {
  const store = {
    current: { ...initial },
    async get() { return { ...store.current }; },
    async markSubmitting() { store.current = { ...store.current, status: "SUBMITTING", attemptCount: store.current.attemptCount + 1 }; return { ...store.current }; },
    async markProcessing(_id: string, taskId: string) { store.current = { ...store.current, status: "PROCESSING", providerTaskId: taskId }; return { ...store.current }; },
    async markCompleted() { store.current = { ...store.current, status: "COMPLETED" }; return { ...store.current }; },
    async markRetrying() { store.current = { ...store.current, status: "RETRYING" }; return { ...store.current }; },
    async markFailed() { store.current = { ...store.current, status: "FAILED" }; return { ...store.current }; },
  };
  return store;
}

const baseJob: OrchestratedSceneJob = {
  id: "job-1", prompt: "complete prompt", providerId: "mock", modelId: "video",
  providerTaskId: null, status: "QUEUED", attemptCount: 0, maximumAttempts: 3,
};

test("three-scene proof primitive persists provider task ids before polling", async () => {
  const store = createStore(baseJob);
  const adapter: SceneVideoProviderAdapter = {
    providerId: "mock",
    async submit() { return { state: "processing", taskId: "provider-task-123" }; },
    async poll() { return { state: "processing" }; },
  };
  const result = await advanceSceneGenerationJob({ jobId: "job-1", idempotencyKey: "idem", store, adapter });
  assert.equal(result.status, "PROCESSING");
  assert.equal(result.providerTaskId, "provider-task-123");
  assert.equal(result.attemptCount, 1);
});

test("mocked provider completion stores a completed state without fake progress", async () => {
  const store = createStore({ ...baseJob, status: "PROCESSING", providerTaskId: "task", attemptCount: 1 });
  const adapter: SceneVideoProviderAdapter = {
    providerId: "mock",
    async submit() { throw new Error("not used"); },
    async poll() { return { state: "completed", outputUrl: "https://cdn.example.com/scene.mp4", durationSeconds: 10 }; },
  };
  const result = await advanceSceneGenerationJob({ jobId: "job-1", idempotencyKey: "idem", store, adapter });
  assert.equal(result.status, "COMPLETED");
});

test("permanent authentication failure does not retry automatically", async () => {
  const store = createStore({ ...baseJob, status: "PROCESSING", providerTaskId: "task", attemptCount: 1 });
  const adapter: SceneVideoProviderAdapter = {
    providerId: "mock",
    async submit() { throw new Error("not used"); },
    async poll() { return { state: "failed", kind: "AUTHENTICATION", code: "AUTH", message: "Connect provider" }; },
  };
  const result = await advanceSceneGenerationJob({ jobId: "job-1", idempotencyKey: "idem", store, adapter });
  assert.equal(result.status, "FAILED");
});

test("wrong provider-reported scene duration is never accepted as completed", async () => {
  const store = createStore({ ...baseJob, status: "PROCESSING", providerTaskId: "task", attemptCount: 3 });
  const adapter: SceneVideoProviderAdapter = {
    providerId: "mock",
    async submit() { throw new Error("not used"); },
    async poll() { return { state: "completed", outputUrl: "https://cdn.example.com/scene.mp4", durationSeconds: 9 }; },
  };
  const result = await advanceSceneGenerationJob({ jobId: "job-1", idempotencyKey: "idem", store, adapter });
  assert.equal(result.status, "FAILED");
});
