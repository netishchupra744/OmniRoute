import { decideRetry } from "../../domain/videoMaker/retryPolicy.ts";
import type { RetryErrorKind, SceneStatus } from "../../domain/videoMaker/types.ts";

export interface OrchestratedSceneJob {
  id: string;
  prompt: string;
  providerId: string;
  modelId: string;
  providerTaskId: string | null;
  status: SceneStatus;
  attemptCount: number;
  maximumAttempts: number;
}

export type ProviderSubmitResult =
  | { state: "processing"; taskId: string; rawResponse?: unknown; pollAfterMs?: number }
  | { state: "completed"; outputUrl?: string; storageKey?: string; mimeType?: string; durationSeconds?: number; costUsd?: number; rawResponse?: unknown };

export type ProviderPollResult =
  | { state: "processing"; rawResponse?: unknown; pollAfterMs?: number }
  | { state: "completed"; outputUrl?: string; storageKey?: string; mimeType?: string; durationSeconds?: number; costUsd?: number; rawResponse?: unknown }
  | { state: "failed"; kind: RetryErrorKind; code: string; message: string; rawResponse?: unknown };

export interface SceneVideoProviderAdapter {
  providerId: string;
  submit(input: { prompt: string; modelId: string; idempotencyKey: string }): Promise<ProviderSubmitResult>;
  poll(input: { taskId: string; modelId: string }): Promise<ProviderPollResult>;
  cancel?(input: { taskId: string; modelId: string }): Promise<void>;
}

export interface SceneJobStore {
  get(jobId: string): Promise<OrchestratedSceneJob | null>;
  markSubmitting(jobId: string): Promise<OrchestratedSceneJob>;
  markProcessing(jobId: string, taskId: string, pollAfterMs: number, rawResponse?: unknown): Promise<OrchestratedSceneJob>;
  markCompleted(jobId: string, output: Extract<ProviderPollResult, { state: "completed" }>): Promise<OrchestratedSceneJob>;
  markRetrying(jobId: string, input: { kind: RetryErrorKind; code: string; message: string; delayMs: number; useFallback: boolean }): Promise<OrchestratedSceneJob>;
  markFailed(jobId: string, input: { kind: RetryErrorKind; code: string; message: string }): Promise<OrchestratedSceneJob>;
}

function assertOutput(result: { outputUrl?: string; storageKey?: string; durationSeconds?: number }): void {
  if (!result.outputUrl && !result.storageKey) {
    throw new Error("Provider completed without a usable video output.");
  }
  if (result.durationSeconds !== undefined && result.durationSeconds !== 10) {
    throw new Error(`Provider reported ${result.durationSeconds} seconds; expected exactly 10.`);
  }
}

export async function advanceSceneGenerationJob(input: {
  jobId: string;
  idempotencyKey: string;
  store: SceneJobStore;
  adapter: SceneVideoProviderAdapter;
  compatibleFallbackAvailable?: boolean;
}): Promise<OrchestratedSceneJob> {
  let job = await input.store.get(input.jobId);
  if (!job) throw new Error("Scene generation job not found.");
  if (job.status === "COMPLETED" || job.status === "CANCELLED" || job.status === "FAILED") return job;

  try {
    if (job.status === "QUEUED" || job.status === "RETRYING") {
      job = await input.store.markSubmitting(job.id);
      const submitted = await input.adapter.submit({ prompt: job.prompt, modelId: job.modelId, idempotencyKey: input.idempotencyKey });
      if (submitted.state === "completed") {
        assertOutput(submitted);
        return input.store.markCompleted(job.id, submitted);
      }
      if (!submitted.taskId) throw new Error("Provider did not return a persistent task ID.");
      return input.store.markProcessing(job.id, submitted.taskId, submitted.pollAfterMs ?? 5_000, submitted.rawResponse);
    }

    if (job.status === "PROCESSING" || job.status === "DOWNLOADING") {
      if (!job.providerTaskId) throw new Error("Processing job is missing its provider task ID.");
      const polled = await input.adapter.poll({ taskId: job.providerTaskId, modelId: job.modelId });
      if (polled.state === "processing") {
        return input.store.markProcessing(job.id, job.providerTaskId, polled.pollAfterMs ?? 5_000, polled.rawResponse);
      }
      if (polled.state === "completed") {
        assertOutput(polled);
        return input.store.markCompleted(job.id, polled);
      }
      const decision = decideRetry({ errorKind: polled.kind, attemptCount: job.attemptCount, maximumAttempts: job.maximumAttempts, compatibleFallbackAvailable: input.compatibleFallbackAvailable });
      return decision.retry
        ? input.store.markRetrying(job.id, { kind: polled.kind, code: polled.code, message: polled.message, delayMs: decision.delayMs, useFallback: decision.useFallbackProvider })
        : input.store.markFailed(job.id, { kind: polled.kind, code: polled.code, message: polled.message });
    }

    return job;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provider failure.";
    const decision = decideRetry({ errorKind: "UNKNOWN", attemptCount: Math.max(job.attemptCount, 1), maximumAttempts: job.maximumAttempts, compatibleFallbackAvailable: input.compatibleFallbackAvailable });
    return decision.retry
      ? input.store.markRetrying(job.id, { kind: "UNKNOWN", code: "PROVIDER_EXCEPTION", message, delayMs: decision.delayMs, useFallback: decision.useFallbackProvider })
      : input.store.markFailed(job.id, { kind: "UNKNOWN", code: "PROVIDER_EXCEPTION", message });
  }
}
