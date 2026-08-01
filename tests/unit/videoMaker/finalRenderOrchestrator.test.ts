import test from "node:test";
import assert from "node:assert/strict";
import { buildFinalRenderTimeline } from "../../../src/domain/videoMaker/renderTimeline.ts";
import {
  advanceFinalRenderJob,
  type FinalRenderJobStore,
  type OrchestratedFinalRenderJob,
} from "../../../src/lib/videoMaker/finalRenderOrchestrator.ts";
import type { FinalRenderProviderAdapter } from "../../../src/lib/videoMaker/finalRenderProviders.ts";

const timeline = buildFinalRenderTimeline(
  Array.from({ length: 33 }, (_, index) => ({
    sceneNumber: index + 1,
    status: "COMPLETED",
    durationSeconds: 10,
    source: { type: "url" as const, value: `https://cdn.example.com/${index + 1}.mp4` },
  }))
);

function createStore(initial: OrchestratedFinalRenderJob): FinalRenderJobStore & { current: OrchestratedFinalRenderJob } {
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

const base: OrchestratedFinalRenderJob = {
  id: "render-1",
  projectId: "project-1",
  providerId: "mock-render",
  modelId: "timeline-v1",
  providerTaskId: null,
  idempotencyKey: "idempotency",
  status: "QUEUED",
  attemptCount: 0,
  maximumAttempts: 3,
  timeline,
  options: {},
};

test("final render persists provider task ID immediately after submission", async () => {
  const store = createStore(base);
  const adapter: FinalRenderProviderAdapter = {
    providerId: "mock-render",
    displayName: "Mock Render",
    async submit() { return { state: "processing", taskId: "render-task-123" }; },
    async poll() { return { state: "processing" }; },
  };
  const result = await advanceFinalRenderJob({ jobId: base.id, store, adapter });
  assert.equal(result.status, "PROCESSING");
  assert.equal(result.providerTaskId, "render-task-123");
});

test("final render accepts an exact 330-second completed output", async () => {
  const store = createStore({ ...base, status: "PROCESSING", providerTaskId: "task", attemptCount: 1 });
  const adapter: FinalRenderProviderAdapter = {
    providerId: "mock-render",
    displayName: "Mock Render",
    async submit() { throw new Error("not used"); },
    async poll() { return { state: "completed", outputUrl: "https://cdn.example.com/final.mp4", reportedDurationSeconds: 330 }; },
  };
  const result = await advanceFinalRenderJob({ jobId: base.id, store, adapter });
  assert.equal(result.status, "COMPLETED");
});

test("final render rejects a provider-reported wrong duration", async () => {
  const store = createStore({ ...base, status: "PROCESSING", providerTaskId: "task", attemptCount: 3 });
  const adapter: FinalRenderProviderAdapter = {
    providerId: "mock-render",
    displayName: "Mock Render",
    async submit() { throw new Error("not used"); },
    async poll() { return { state: "completed", outputUrl: "https://cdn.example.com/final.mp4", reportedDurationSeconds: 329 }; },
  };
  const result = await advanceFinalRenderJob({ jobId: base.id, store, adapter });
  assert.equal(result.status, "FAILED");
});
