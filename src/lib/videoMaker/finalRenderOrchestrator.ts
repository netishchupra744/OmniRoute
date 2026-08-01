import { EXPECTED_FINAL_DURATION_SECONDS } from "../../domain/videoMaker/duration.ts";
import { decideRetry } from "../../domain/videoMaker/retryPolicy.ts";
import type { FinalRenderTimeline } from "../../domain/videoMaker/renderTimeline.ts";
import type { RetryErrorKind } from "../../domain/videoMaker/types.ts";
import type {
  FinalRenderOptions,
  FinalRenderPollResult,
  FinalRenderProviderAdapter,
  FinalRenderProviderResult,
} from "./finalRenderProviders.ts";

export type FinalRenderStatus =
  | "QUEUED"
  | "SUBMITTING"
  | "PROCESSING"
  | "DOWNLOADING"
  | "COMPLETED"
  | "RETRYING"
  | "FAILED"
  | "CANCELLED";

export interface OrchestratedFinalRenderJob {
  id: string;
  projectId: string;
  providerId: string;
  modelId: string | null;
  providerTaskId: string | null;
  idempotencyKey: string;
  status: FinalRenderStatus;
  attemptCount: number;
  maximumAttempts: number;
  timeline: FinalRenderTimeline;
  options: FinalRenderOptions;
}

export interface FinalRenderJobStore {
  get(jobId: string): Promise<OrchestratedFinalRenderJob | null>;
  markSubmitting(jobId: string): Promise<OrchestratedFinalRenderJob>;
  markProcessing(
    jobId: string,
    taskId: string,
    pollAfterMs: number,
    rawResponse?: unknown,
    estimatedCostUsd?: number
  ): Promise<OrchestratedFinalRenderJob>;
  markCompleted(
    jobId: string,
    output: Extract<FinalRenderPollResult | FinalRenderProviderResult, { state: "completed" }>
  ): Promise<OrchestratedFinalRenderJob>;
  markRetrying(
    jobId: string,
    input: {
      kind: RetryErrorKind;
      code: string;
      message: string;
      delayMs: number;
    }
  ): Promise<OrchestratedFinalRenderJob>;
  markFailed(
    jobId: string,
    input: { kind: RetryErrorKind; code: string; message: string }
  ): Promise<OrchestratedFinalRenderJob>;
}

function validateCompletedOutput(output: {
  outputUrl?: string;
  storageKey?: string;
  reportedDurationSeconds?: number;
}): void {
  if (!output.outputUrl && !output.storageKey) {
    throw new Error("Render provider completed without a usable MP4 output.");
  }
  if (
    output.reportedDurationSeconds !== undefined &&
    output.reportedDurationSeconds !== EXPECTED_FINAL_DURATION_SECONDS
  ) {
    throw new Error(
      `Render provider reported ${output.reportedDurationSeconds} seconds; expected exactly ${EXPECTED_FINAL_DURATION_SECONDS}.`
    );
  }
}

export async function advanceFinalRenderJob(input: {
  jobId: string;
  store: FinalRenderJobStore;
  adapter: FinalRenderProviderAdapter;
}): Promise<OrchestratedFinalRenderJob> {
  let job = await input.store.get(input.jobId);
  if (!job) throw new Error("Final render job not found.");
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) return job;

  try {
    if (job.status === "QUEUED" || job.status === "RETRYING") {
      job = await input.store.markSubmitting(job.id);
      const result = await input.adapter.submit({
        projectId: job.projectId,
        modelId: job.modelId,
        idempotencyKey: job.idempotencyKey,
        timeline: job.timeline,
        options: job.options,
      });
      if (result.state === "completed") {
        validateCompletedOutput(result);
        return input.store.markCompleted(job.id, result);
      }
      if (!result.taskId) throw new Error("Render provider did not return a persistent task ID.");
      return input.store.markProcessing(
        job.id,
        result.taskId,
        result.pollAfterMs ?? 10_000,
        result.rawResponse,
        result.estimatedCostUsd
      );
    }

    if (job.status === "PROCESSING" || job.status === "DOWNLOADING") {
      if (!job.providerTaskId) throw new Error("Processing render job is missing its provider task ID.");
      const result = await input.adapter.poll({
        taskId: job.providerTaskId,
        modelId: job.modelId,
      });
      if (result.state === "processing") {
        return input.store.markProcessing(
          job.id,
          job.providerTaskId,
          result.pollAfterMs ?? 10_000,
          result.rawResponse
        );
      }
      if (result.state === "completed") {
        validateCompletedOutput(result);
        return input.store.markCompleted(job.id, result);
      }
      const decision = decideRetry({
        errorKind: result.kind,
        attemptCount: Math.max(job.attemptCount, 1),
        maximumAttempts: job.maximumAttempts,
      });
      return decision.retry
        ? input.store.markRetrying(job.id, {
            kind: result.kind,
            code: result.code,
            message: result.message,
            delayMs: decision.delayMs,
          })
        : input.store.markFailed(job.id, {
            kind: result.kind,
            code: result.code,
            message: result.message,
          });
    }

    return job;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown final render failure.";
    const decision = decideRetry({
      errorKind: "UNKNOWN",
      attemptCount: Math.max(job.attemptCount, 1),
      maximumAttempts: job.maximumAttempts,
    });
    return decision.retry
      ? input.store.markRetrying(job.id, {
          kind: "UNKNOWN",
          code: "RENDER_PROVIDER_EXCEPTION",
          message,
          delayMs: decision.delayMs,
        })
      : input.store.markFailed(job.id, {
          kind: "UNKNOWN",
          code: "RENDER_PROVIDER_EXCEPTION",
          message,
        });
  }
}
