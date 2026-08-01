import test from "node:test";
import assert from "node:assert/strict";
import {
  getSceneVideoProviderAdapter,
  listSceneVideoProviderAdapters,
  registerSceneVideoProviderAdapter,
  unregisterSceneVideoProviderAdapter,
} from "../../../src/lib/videoMaker/sceneVideoProviders.ts";

test("scene provider registry enforces one adapter per provider", () => {
  unregisterSceneVideoProviderAdapter("mock-registry");
  registerSceneVideoProviderAdapter({
    providerId: "mock-registry",
    displayName: "Mock Registry",
    maxConcurrent: 2,
    async submit() { return { state: "processing", taskId: "task" }; },
    async poll() { return { state: "processing" }; },
  });
  assert.equal(getSceneVideoProviderAdapter("mock-registry")?.maxConcurrent, 2);
  assert.equal(listSceneVideoProviderAdapters().some((item) => item.providerId === "mock-registry"), true);
  assert.throws(() => registerSceneVideoProviderAdapter({
    providerId: "mock-registry",
    displayName: "Duplicate",
    async submit() { return { state: "processing", taskId: "task" }; },
    async poll() { return { state: "processing" }; },
  }), /already registered/);
  unregisterSceneVideoProviderAdapter("mock-registry");
});
