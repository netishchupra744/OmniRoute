import { createHash, randomUUID } from "node:crypto";
import { EXPECTED_FINAL_DURATION_SECONDS } from "@/domain/videoMaker/duration";
import {
  buildFinalRenderTimeline,
  type CompletedRenderScene,
  type FinalRenderTimeline,
} from "@/domain/videoMaker/renderTimeline";
import type { RetryErrorKind } from "@/domain/videoMaker/types";
import type {
  FinalRenderJobStore,
  FinalRenderStatus,
  OrchestratedFinalRenderJob,
} from "@/lib/videoMaker/finalRenderOrchestrator";
import type {
  FinalRenderOptions,
  FinalRenderPollResult,
  FinalRenderProviderResult,
} from "@/lib/videoMaker/finalRenderProviders";
import { validateProviderOutputUrl } from "@/lib/videoMaker/outputSecurity";
import { sanitizeProviderPayload } from "@/lib/videoMaker/responseSanitizer";
import { getDbInstance, rowToCamel } from "./core";
import { getVideoProject, setVideoProjectStatus } from "./videoProjects";

export interface ProjectRenderJobRecord extends OrchestratedFinalRenderJob {
  expectedDurationSeconds: number;
  reportedDurationSeconds: number | null;
  outputUrl: string | null;
  outputStorageKey: string | null;
  nextPollAt: string | null;
  nextRetryAt: string | null;
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
  statusMessage: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorHistory: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

const RENDER_TRANSITIONS: Record<FinalRenderStatus, ReadonlySet<FinalRenderStatus>> = {
  QUEUED: new Set(["SUBMITTING", "FAILED", "CANCELLED"]),
  SUBMITTING: new Set(["PROCESSING", "COMPLETED", "RETRYING", "FAILED", "CANCELLED"]),
  PROCESSING: new Set(["DOWNLOADING", "COMPLETED", "RETRYING", "FAILED", "CANCELLED"]),
  DOWNLOADING: new Set(["COMPLETED", "RETRYING", "FAILED", "CANCELLED"]),
  COMPLETED: new Set(),
  RETRYING: new Set(["SUBMITTING", "FAILED", "CANCELLED"]),
  FAILED: new Set(["RETRYING", "CANCELLED"]),
  CANCELLED: new Set(["QUEUED"]),
};

function assertRenderTransition(from: FinalRenderStatus, to: FinalRenderStatus): void {
  if (from !== to && !RENDER_TRANSITIONS[from].has(to)) {
    throw new Error(`Illegal final render status transition: ${from} -> ${to}`);
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function mapRenderJob(row: unknown): ProjectRenderJobRecord | null {
  const value = rowToCamel(row) as Record<string, unknown> | null;
  if (!value) return null;
  return {
    id: String(value.id),
    projectId: String(value.projectId),
    providerId: String(value.providerId),
    modelId: stringOrNull(value.modelId),
    providerTaskId: stringOrNull(value.providerTaskId),
    idempotencyKey: String(value.idempotencyKey),
    status: value.status as FinalRenderStatus,
    attemptCount: Number(value.attemptCount),
    maximumAttempts: Number(value.maximumAttempts),
    timeline: value.timeline as FinalRenderTimeline,
    options:
      value.options && typeof value.options === "object"
        ? (value.options as FinalRenderOptions)
        : {},
    expectedDurationSeconds: Number(value.expectedDurationSeconds),
    reportedDurationSeconds: numberOrNull(value.reportedDurationSeconds),
    outputUrl: stringOrNull(value.outputUrl),
    outputStorageKey: stringOrNull(value.outputStorageKey),
    nextPollAt: stringOrNull(value.nextPollAt),
    nextRetryAt: stringOrNull(value.nextRetryAt),
    estimatedCostUsd: numberOrNull(value.estimatedCostUsd),
    actualCostUsd: numberOrNull(value.actualCostUsd),
    statusMessage: stringOrNull(value.statusMessage),
    errorCode: stringOrNull(value.errorCode),
    errorMessage: stringOrNull(value.errorMessage),
    errorHistory: Array.isArray(value.errorHistory)
      ? (value.errorHistory as Array<Record<string, unknown>>)
      : [],
    createdAt: String(value.createdAt),
    updatedAt: String(value.updatedAt),
  };
}

function loadCompletedTimeline(projectId: string): {
  timeline: FinalRenderTimeline;
  outputIds: string[];
} {
  const rows = getDbInstance()
    .prepare(
      `SELECT s.scene_number, s.status, o.id AS output_id, o.output_url,
              o.storage_key, o.duration_seconds
       FROM project_scenes s
       LEFT JOIN scene_outputs o ON o.scene_id = s.id AND o.is_current = 1
       WHERE s.project_id = ?
       ORDER BY s.scene_number`
    )
    .all(projectId) as Array<Record<string, unknown>>;

  const outputIds: string[] = [];
  const scenes: CompletedRenderScene[] = rows.map((row) => {
    const sceneNumber = Number(row.scene_number);
    const outputId = typeof row.output_id === "string" ? row.output_id : null;
    const outputUrl = typeof row.output_url === "string" ? row.output_url : null;
    const storageKey = typeof row.storage_key === "string" ? row.storage_key : null;
    if (!outputId || (!outputUrl && !storageKey)) {
      throw new Error(`Scene ${sceneNumber} has no current completed video output.`);
    }
    outputIds.push(outputId);
    return {
      sceneNumber,
      status: String(row.status),
      durationSeconds: Number(row.duration_seconds),
      source: outputUrl
        ? { type: "url", value: outputUrl }
        : { type: "storage", value: storageKey! },
    };
  });

  return { timeline: buildFinalRenderTimeline(scenes), outputIds };
}

export function createProjectRenderJob(input: {
  projectId: string;
  providerId: string;
  modelId?: string | null;
  options?: FinalRenderOptions;
}): ProjectRenderJobRecord {
  const project = getVideoProject(input.projectId);
  if (!project) throw new Error("Video project not found.");
  if (!input.providerId.trim()) throw new Error("Render provider is required.");

  const { timeline, outputIds } = loadCompletedTimeline(input.projectId);
  const options = input.options ?? {};
  const idempotencyKey = createHash("sha256")
    .update(
      JSON.stringify({
        projectId: input.projectId,
        outputIds,
        providerId: input.providerId,
        modelId: input.modelId ?? null,
        options,
      })
    )
    .digest("hex");
  const existing = getProjectRenderJobByIdempotencyKey(idempotencyKey);
  if (existing) return existing;

  const id = randomUUID();
  const db = getDbInstance();

  db.transaction(() => {
    db.prepare(
      `INSERT OR IGNORE INTO project_render_jobs (
        id, project_id, provider_id, model_id, idempotency_key, status,
        timeline_json, options_json, expected_duration_seconds, status_message
      ) VALUES (?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?, 'Queued for cloud rendering')`
    ).run(
      id,
      input.projectId,
      input.providerId,
      input.modelId ?? null,
      idempotencyKey,
      JSON.stringify(timeline),
      JSON.stringify(options),
      EXPECTED_FINAL_DURATION_SECONDS
    );
    const job = db
      .prepare("SELECT id FROM project_render_jobs WHERE idempotency_key = ?")
      .get(idempotencyKey) as { id?: unknown } | undefined;
    if (!job?.id) throw new Error("Final render job was not persisted.");
    db.prepare(
      `UPDATE video_projects SET current_render_job_id = ?, status = 'RENDERING',
       last_error_code = NULL, last_error_message = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(String(job.id), input.projectId);
  })();

  const created = getProjectRenderJobByIdempotencyKey(idempotencyKey);
  if (!created) throw new Error("Final render job was not persisted.");
  return created;
}

export function getProjectRenderJob(jobId: string): ProjectRenderJobRecord | null {
  return mapRenderJob(
    getDbInstance().prepare("SELECT * FROM project_render_jobs WHERE id = ?").get(jobId)
  );
}

function getProjectRenderJobByIdempotencyKey(
  idempotencyKey: string
): ProjectRenderJobRecord | null {
  return mapRenderJob(
    getDbInstance()
      .prepare("SELECT * FROM project_render_jobs WHERE idempotency_key = ?")
      .get(idempotencyKey)
  );
}

export function listProjectRenderJobs(projectId: string): ProjectRenderJobRecord[] {
  return getDbInstance()
    .prepare(
      "SELECT * FROM project_render_jobs WHERE project_id = ? ORDER BY created_at DESC"
    )
    .all(projectId)
    .map(mapRenderJob)
    .filter((job): job is ProjectRenderJobRecord => job !== null);
}

export function listResumableProjectRenderJobs(limit = 20): ProjectRenderJobRecord[] {
  return getDbInstance()
    .prepare(
      `SELECT * FROM project_render_jobs
       WHERE status IN ('QUEUED','PROCESSING','RETRYING','DOWNLOADING')
       AND (next_poll_at IS NULL OR next_poll_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       AND (next_retry_at IS NULL OR next_retry_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ORDER BY updated_at LIMIT ?`
    )
    .all(Math.min(Math.max(limit, 1), 200))
    .map(mapRenderJob)
    .filter((job): job is ProjectRenderJobRecord => job !== null);
}

function updateStatus(input: {
  jobId: string;
  status: FinalRenderStatus;
  statusMessage: string;
  providerTaskId?: string | null;
  nextPollAt?: string | null;
  nextRetryAt?: string | null;
  incrementAttempt?: boolean;
  rawResponse?: unknown;
  estimatedCostUsd?: number;
}): ProjectRenderJobRecord {
  const current = getProjectRenderJob(input.jobId);
  if (!current) throw new Error("Final render job not found.");
  assertRenderTransition(current.status, input.status);
  getDbInstance()
    .prepare(
      `UPDATE project_render_jobs SET status = ?, status_message = ?,
       provider_task_id = COALESCE(?, provider_task_id), next_poll_at = ?, next_retry_at = ?,
       attempt_count = attempt_count + ?, estimated_cost_usd = COALESCE(?, estimated_cost_usd),
       submitted_at = CASE WHEN ? = 'SUBMITTING' AND submitted_at IS NULL
         THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE submitted_at END,
       raw_response_json = COALESCE(?, raw_response_json),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    )
    .run(
      input.status,
      input.statusMessage,
      input.providerTaskId ?? null,
      input.nextPollAt ?? null,
      input.nextRetryAt ?? null,
      input.incrementAttempt ? 1 : 0,
      input.estimatedCostUsd ?? null,
      input.status,
      input.rawResponse === undefined
        ? null
        : JSON.stringify(sanitizeProviderPayload(input.rawResponse)),
      input.jobId
    );
  return getProjectRenderJob(input.jobId)!;
}

export function createFinalRenderJobStore(): FinalRenderJobStore {
  return {
    async get(jobId) {
      return getProjectRenderJob(jobId);
    },
    async markSubmitting(jobId) {
      return updateStatus({
        jobId,
        status: "SUBMITTING",
        statusMessage: "Submitting to render provider",
        incrementAttempt: true,
      });
    },
    async markProcessing(jobId, taskId, pollAfterMs, rawResponse, estimatedCostUsd) {
      return updateStatus({
        jobId,
        status: "PROCESSING",
        statusMessage: "Cloud renderer is processing the timeline",
        providerTaskId: taskId,
        nextPollAt: new Date(Date.now() + pollAfterMs).toISOString(),
        rawResponse,
        estimatedCostUsd,
      });
    },
    async markCompleted(jobId, output) {
      return completeProjectRenderJob(jobId, output);
    },
    async markRetrying(jobId, input) {
      return recordProjectRenderFailure({
        jobId,
        status: "RETRYING",
        errorKind: input.kind,
        errorCode: input.code,
        errorMessage: input.message,
        nextRetryAt: new Date(Date.now() + input.delayMs).toISOString(),
      });
    },
    async markFailed(jobId, input) {
      return recordProjectRenderFailure({
        jobId,
        status: "FAILED",
        errorKind: input.kind,
        errorCode: input.code,
        errorMessage: input.message,
      });
    },
  };
}

function completeProjectRenderJob(
  jobId: string,
  output: Extract<FinalRenderPollResult | FinalRenderProviderResult, { state: "completed" }>
): ProjectRenderJobRecord {
  const current = getProjectRenderJob(jobId);
  if (!current) throw new Error("Final render job not found.");
  assertRenderTransition(current.status, "COMPLETED");
  if (!output.outputUrl && !output.storageKey) {
    throw new Error("Render provider completed without an output.");
  }
  if (output.outputUrl) validateProviderOutputUrl(output.outputUrl);
  if (
    output.reportedDurationSeconds !== undefined &&
    output.reportedDurationSeconds !== EXPECTED_FINAL_DURATION_SECONDS
  ) {
    throw new Error("Final render duration does not equal exactly 330 seconds.");
  }
  const db = getDbInstance();
  db.transaction(() => {
    db.prepare(
      `UPDATE project_render_jobs SET status = 'COMPLETED', output_url = ?,
       output_storage_key = ?, reported_duration_seconds = ?, actual_cost_usd = ?,
       completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), status_message = 'Completed',
       error_code = NULL, error_message = NULL, raw_response_json = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(
      output.outputUrl ?? null,
      output.storageKey ?? null,
      output.reportedDurationSeconds ?? null,
      output.actualCostUsd ?? null,
      JSON.stringify(sanitizeProviderPayload(output.rawResponse ?? {})),
      jobId
    );
    db.prepare(
      `UPDATE video_projects SET status = 'COMPLETED', final_output_url = ?,
       final_output_storage_key = ?, final_duration_seconds = ?,
       last_error_code = NULL, last_error_message = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(
      output.outputUrl ?? null,
      output.storageKey ?? null,
      output.reportedDurationSeconds ?? null,
      current.projectId
    );
  })();
  return getProjectRenderJob(jobId)!;
}

function recordProjectRenderFailure(input: {
  jobId: string;
  status: "RETRYING" | "FAILED";
  errorKind: RetryErrorKind;
  errorCode: string;
  errorMessage: string;
  nextRetryAt?: string | null;
}): ProjectRenderJobRecord {
  const current = getProjectRenderJob(input.jobId);
  if (!current) throw new Error("Final render job not found.");
  assertRenderTransition(current.status, input.status);
  const errorHistory = [
    ...current.errorHistory,
    {
      at: new Date().toISOString(),
      attempt: current.attemptCount,
      kind: input.errorKind,
      code: input.errorCode,
      message: input.errorMessage.slice(0, 2_000),
    },
  ];
  const db = getDbInstance();
  db.transaction(() => {
    db.prepare(
      `UPDATE project_render_jobs SET status = ?, error_code = ?, error_message = ?,
       error_history_json = ?, next_retry_at = ?, status_message = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(
      input.status,
      input.errorCode,
      input.errorMessage.slice(0, 2_000),
      JSON.stringify(errorHistory),
      input.nextRetryAt ?? null,
      input.status === "RETRYING" ? "Waiting to retry cloud rendering" : "Cloud rendering failed",
      input.jobId
    );
    if (input.status === "FAILED") {
      setVideoProjectStatus(current.projectId, "FAILED", {
        code: input.errorCode,
        message: input.errorMessage.slice(0, 2_000),
      });
    }
  })();
  return getProjectRenderJob(input.jobId)!;
}

export function cancelProjectRenderJob(jobId: string): ProjectRenderJobRecord {
  const current = getProjectRenderJob(jobId);
  if (!current) throw new Error("Final render job not found.");
  if (current.status === "COMPLETED") throw new Error("A completed render cannot be cancelled.");
  const updated = updateStatus({
    jobId,
    status: "CANCELLED",
    statusMessage: "Cancelled by user",
  });
  setVideoProjectStatus(current.projectId, "READY_TO_RENDER");
  return updated;
}
