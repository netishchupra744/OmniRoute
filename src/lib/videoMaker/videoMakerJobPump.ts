import { createFinalRenderJobStore, listResumableProjectRenderJobs } from "@/lib/db/renderJobs";
import { listResumableSceneGenerationJobs } from "@/lib/db/sceneGenerationJobs";
import { advanceFinalRenderJob } from "./finalRenderOrchestrator";
import { getFinalRenderProviderAdapter } from "./finalRenderProviders";
import { advanceSceneGenerationJob } from "./sceneJobOrchestrator";
import { createPersistentSceneJobStore } from "./sceneJobStore";
import { getSceneVideoProviderAdapter } from "./sceneVideoProviders";

export interface VideoMakerJobPumpResult {
  offline: boolean;
  advanced: Array<{ jobId: string; status: string }>;
  blocked: Array<{ jobId: string; reason: string }>;
  failed: Array<{ jobId: string; reason: string }>;
  renderAdvanced: Array<{ jobId: string; status: string }>;
  renderBlocked: Array<{ jobId: string; reason: string }>;
  renderFailed: Array<{ jobId: string; reason: string }>;
}

/**
 * Advances each due job by one durable state transition. It deliberately does
 * not invent progress or keep paid provider calls in memory-only state.
 */
export async function runVideoMakerSceneJobPumpOnce(input: {
  online: boolean;
  limit?: number;
}): Promise<VideoMakerJobPumpResult> {
  if (!input.online) {
    return {
      offline: true,
      advanced: [],
      blocked: [],
      failed: [],
      renderAdvanced: [],
      renderBlocked: [],
      renderFailed: [],
    };
  }

  const dueJobs = listResumableSceneGenerationJobs(input.limit ?? 20);
  const result: VideoMakerJobPumpResult = {
    offline: false,
    advanced: [],
    blocked: [],
    failed: [],
    renderAdvanced: [],
    renderBlocked: [],
    renderFailed: [],
  };
  const providerCounts = new Map<string, number>();
  const store = createPersistentSceneJobStore();

  for (const job of dueJobs) {
    const adapter = getSceneVideoProviderAdapter(job.providerId);
    if (!adapter) {
      result.blocked.push({
        jobId: job.id,
        reason: `No verified asynchronous adapter is registered for ${job.providerId}.`,
      });
      continue;
    }
    const activeForProvider = providerCounts.get(job.providerId) ?? 0;
    const maxConcurrent = adapter.maxConcurrent ?? 1;
    if (activeForProvider >= maxConcurrent) {
      result.blocked.push({
        jobId: job.id,
        reason: `Provider concurrency limit (${maxConcurrent}) reached.`,
      });
      continue;
    }
    providerCounts.set(job.providerId, activeForProvider + 1);
    try {
      const updated = await advanceSceneGenerationJob({
        jobId: job.id,
        idempotencyKey: job.idempotencyKey,
        store,
        adapter,
        compatibleFallbackAvailable: Boolean(
          job.fallbackProviderId &&
          job.fallbackModelId &&
          getSceneVideoProviderAdapter(job.fallbackProviderId)
        ),
      });
      result.advanced.push({ jobId: job.id, status: updated.status });
    } catch (error) {
      result.failed.push({
        jobId: job.id,
        reason: error instanceof Error ? error.message : "Unknown scene job pump error.",
      });
    } finally {
      providerCounts.set(job.providerId, Math.max(0, (providerCounts.get(job.providerId) ?? 1) - 1));
    }
  }

  const renderStore = createFinalRenderJobStore();
  for (const job of listResumableProjectRenderJobs(Math.min(input.limit ?? 20, 20))) {
    const adapter = getFinalRenderProviderAdapter(job.providerId);
    if (!adapter) {
      result.renderBlocked.push({
        jobId: job.id,
        reason: `No verified cloud render adapter is registered for ${job.providerId}.`,
      });
      continue;
    }
    try {
      const updated = await advanceFinalRenderJob({
        jobId: job.id,
        store: renderStore,
        adapter,
      });
      result.renderAdvanced.push({ jobId: job.id, status: updated.status });
    } catch (error) {
      result.renderFailed.push({
        jobId: job.id,
        reason: error instanceof Error ? error.message : "Unknown render job pump error.",
      });
    }
  }

  return result;
}
