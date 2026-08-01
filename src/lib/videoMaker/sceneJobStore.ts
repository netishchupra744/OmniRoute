import {
  getSceneGenerationJob,
  recordSceneGenerationFailure,
  saveSceneOutput,
  transitionSceneGenerationJob,
} from "@/lib/db/sceneGenerationJobs";
import type {
  OrchestratedSceneJob,
  SceneJobStore,
} from "./sceneJobOrchestrator";

function getRequiredJob(jobId: string): OrchestratedSceneJob {
  const job = getSceneGenerationJob(jobId);
  if (!job) throw new Error("Scene generation job not found.");
  return job;
}

export function createPersistentSceneJobStore(): SceneJobStore {
  return {
    async get(jobId) {
      return getSceneGenerationJob(jobId);
    },
    async markSubmitting(jobId) {
      return transitionSceneGenerationJob({
        jobId,
        status: "SUBMITTING",
        statusMessage: "Submitting to video provider",
        incrementAttempt: true,
      });
    },
    async markProcessing(jobId, taskId, pollAfterMs, rawResponse) {
      return transitionSceneGenerationJob({
        jobId,
        status: "PROCESSING",
        statusMessage: "Video provider is processing the scene",
        providerTaskId: taskId,
        nextPollAt: new Date(Date.now() + pollAfterMs).toISOString(),
        rawResponse,
      });
    },
    async markCompleted(jobId, output) {
      saveSceneOutput({
        jobId,
        outputUrl: output.outputUrl ?? null,
        storageKey: output.storageKey ?? null,
        mimeType: output.mimeType ?? "video/mp4",
        durationSeconds: output.durationSeconds ?? null,
        costUsd: output.costUsd ?? null,
        rawResponse: output.rawResponse,
      });
      return getRequiredJob(jobId);
    },
    async markRetrying(jobId, input) {
      return recordSceneGenerationFailure({
        jobId,
        status: "RETRYING",
        errorKind: input.kind,
        errorCode: input.code,
        errorMessage: input.message,
        nextRetryAt: new Date(Date.now() + input.delayMs).toISOString(),
        useFallback: input.useFallback,
      });
    },
    async markFailed(jobId, input) {
      return recordSceneGenerationFailure({
        jobId,
        status: "FAILED",
        errorKind: input.kind,
        errorCode: input.code,
        errorMessage: input.message,
      });
    },
  };
}
