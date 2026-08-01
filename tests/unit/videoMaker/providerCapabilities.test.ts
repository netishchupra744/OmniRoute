import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateVideoModelCompatibility,
  filterCompatibleVideoModels,
} from "../../../src/domain/videoMaker/providerCapabilities.ts";
import type {
  VideoGenerationRequirements,
  VideoModelCapabilities,
} from "../../../src/domain/videoMaker/types.ts";

const compatible: VideoModelCapabilities = {
  providerId: "mock-cloud",
  modelId: "presenter-10s",
  displayName: "Mock Presenter 10s",
  supportsTextToVideo: true,
  supportsImageToVideo: true,
  supportsReferenceImage: true,
  supportsNativeAudio: true,
  supportsBanglaVoice: true,
  supportsLipSync: true,
  supportsTenSecondDuration: true,
  supportsSixteenByNine: true,
  supports1080p: true,
  supportsSeed: true,
  supportsAsyncJobs: true,
  supportsFinalRendering: false,
  maximumDuration: 10,
  supportedAspectRatios: ["16:9"],
  estimatedCost: 1.25,
  rateLimitCategory: "professional-video",
};

const requirements: VideoGenerationRequirements = {
  mode: "native-video-audio",
  requiresReferenceImage: true,
  requiresBanglaVoice: true,
  requiresLipSync: true,
  durationSeconds: 10,
  aspectRatio: "16:9",
  width: 1920,
  height: 1080,
  requiresAsyncJobs: true,
};

test("accepts only capability-compatible presenter models", () => {
  assert.deepEqual(evaluateVideoModelCompatibility(compatible, requirements), {
    compatible: true,
    reasons: [],
  });
});

test("rejects local-only and non-reference-image models", () => {
  const incompatible = {
    ...compatible,
    modelId: "local-no-reference",
    localOnly: true,
    supportsReferenceImage: false,
  };
  const result = evaluateVideoModelCompatibility(incompatible, requirements);
  assert.equal(result.compatible, false);
  assert.match(result.reasons.join("\n"), /Local-only/);
  assert.match(result.reasons.join("\n"), /reference images/);
  assert.deepEqual(filterCompatibleVideoModels([incompatible, compatible], requirements), [compatible]);
});
