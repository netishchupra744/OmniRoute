import { createHash, randomUUID } from "node:crypto";
import { assertSceneTransition } from "@/domain/videoMaker/jobStateMachine";
import { SCENE_STATUSES, type RetryErrorKind, type SceneStatus } from "@/domain/videoMaker/types";
import { sanitizeProviderPayload } from "@/lib/videoMaker/responseSanitizer";
import { validateProviderOutputUrl } from "@/lib/videoMaker/outputSecurity";
import { getDbInstance, rowToCamel } from "./core";
import { setVideoProjectStatus } from "./videoProjects";

export interface SceneGenerationJobRecord {
  id: string;
  projectId: string;
  sceneId: string;
  sceneNumber: number;
  sceneTitle: string;
  promptVersionId: string;
  promptText: string;
  providerId: string;
  modelId: string;
  providerTaskId: string | null;
  idempotencyKey: string;
  status: SceneStatus;
  attemptCount: number;
  maximumAttempts: number;
  fallbackProviderId: string | null;
  fallbackModelId: string | null;
  nextPollAt: string | null;
  nextRetryAt: string | null;
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
  statusMessage: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorHistory: Array<Record<string, unknown>>;
  outputUrl: string | null;
  outputStorageKey: string | null;
  outputDurationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SceneOutputRecord {
  id: string;
  projectId: string;
  sceneId: string;
  generationJobId: string;
  providerTaskId: string | null;
  outputUrl: string | null;
  storageKey: string | null;
  mimeType: string | null;
  durationSeconds: number | null;
  providerId: string;
  modelId: string;
  costUsd: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}
function mapJob(row: unknown): SceneGenerationJobRecord | null {
  const value = rowToCamel(row) as Record<string, unknown> | null;
  if (!value) return null;
  return {
    id: String(value.id),
    projectId: String(value.projectId),
    sceneId: String(value.sceneId),
    sceneNumber: Number(value.sceneNumber),
    sceneTitle: String(value.sceneTitle),
    promptVersionId: String(value.promptVersionId),
    promptText: String(value.promptText),
    providerId: String(value.providerId),
    modelId: String(value.modelId),
    providerTaskId: nullableString(value.providerTaskId),
    idempotencyKey: String(value.idempotencyKey),
    status: value.status as SceneStatus,
    attemptCount: Number(value.attemptCount),
    maximumAttempts: Number(value.maximumAttempts),
    fallbackProviderId: nullableString(value.fallbackProviderId),
    fallbackModelId: nullableString(value.fallbackModelId),
    nextPollAt: nullableString(value.nextPollAt),
    nextRetryAt: nullableString(value.nextRetryAt),
    estimatedCostUsd: nullableNumber(value.estimatedCostUsd),
    actualCostUsd: nullableNumber(value.actualCostUsd),
    statusMessage: nullableString(value.statusMessage),
    errorCode: nullableString(value.errorCode),
    errorMessage: nullableString(value.errorMessage),
    errorHistory: Array.isArray(value.errorHistory) ? value.errorHistory as Array<Record<string, unknown>> : [],
    outputUrl: nullableString(value.outputUrl),
    outputStorageKey: nullableString(value.outputStorageKey),
    outputDurationSeconds: nullableNumber(value.outputDurationSeconds),
    createdAt: String(value.createdAt),
    updatedAt: String(value.updatedAt),
  };
}

const JOB_SELECT = `SELECT j.*, s.scene_number, s.title AS scene_title,
 p.prompt_text, p.id AS prompt_version_id,
 o.output_url, o.storage_key AS output_storage_key,
 o.duration_seconds AS output_duration_seconds
 FROM scene_generation_jobs j
 JOIN project_scenes s ON s.id = j.scene_id
 JOIN scene_prompt_versions p ON p.id = j.prompt_version_id
 LEFT JOIN scene_outputs o ON o.generation_job_id = j.id AND o.is_current = 1`;

export function createSceneGenerationJobs(input: {
  projectId: string;
  providerId: string;
  modelId: string;
  sceneNumbers?: number[];
  fallbackProviderId?: string | null;
  fallbackModelId?: string | null;
}): SceneGenerationJobRecord[] {
  const db = getDbInstance();
  const requested = input.sceneNumbers?.length ? new Set(input.sceneNumbers) : null;
  const scenes = db.prepare(
    `SELECT id, scene_number, current_prompt_version_id, status
     FROM project_scenes WHERE project_id = ? ORDER BY sort_order, scene_number`
  ).all(input.projectId) as Array<Record<string, unknown>>;
  if (scenes.length === 0) throw new Error("Create and validate the 33-scene plan before generation.");
  if (requested && [...requested].some((n) => !Number.isInteger(n) || n < 1 || n > 33)) {
    throw new Error("Scene numbers must be integers between 1 and 33.");
  }

  db.transaction(() => {
    for (const scene of scenes) {
      const sceneNumber = Number(scene.scene_number);
      if (requested && !requested.has(sceneNumber)) continue;
      const currentStatus = String(scene.status) as SceneStatus;
      if (currentStatus === "COMPLETED") continue;
      const promptVersionId = typeof scene.current_prompt_version_id === "string" ? scene.current_prompt_version_id : null;
      if (!promptVersionId) throw new Error(`Scene ${sceneNumber} has no compiled prompt.`);
      const idempotencyKey = createHash("sha256")
        .update(`${input.projectId}:${scene.id}:${promptVersionId}:${input.providerId}:${input.modelId}`)
        .digest("hex");
      const id = randomUUID();
      db.prepare(
        `INSERT OR IGNORE INTO scene_generation_jobs (
          id, project_id, scene_id, prompt_version_id, provider_id, model_id,
          idempotency_key, status, maximum_attempts, fallback_provider_id,
          fallback_model_id, status_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', 3, ?, ?, 'Queued for provider submission')`
      ).run(
        id,
        input.projectId,
        scene.id,
        promptVersionId,
        input.providerId,
        input.modelId,
        idempotencyKey,
        input.fallbackProviderId ?? null,
        input.fallbackModelId ?? null
      );
      if (SCENE_STATUSES.includes(currentStatus) && currentStatus !== "QUEUED") {
        if (["PROMPT_READY", "FAILED", "CANCELLED", "RETRYING"].includes(currentStatus)) {
          db.prepare(
            `UPDATE project_scenes SET status = 'QUEUED', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
          ).run(scene.id);
        }
      }
    }
  })();
  setVideoProjectStatus(input.projectId, "GENERATING");
  return listSceneGenerationJobs(input.projectId);
}

export function listSceneGenerationJobs(projectId: string): SceneGenerationJobRecord[] {
  return getDbInstance()
    .prepare(`${JOB_SELECT} WHERE j.project_id = ? ORDER BY s.scene_number, j.created_at DESC`)
    .all(projectId)
    .map(mapJob)
    .filter((job): job is SceneGenerationJobRecord => job !== null);
}

export function getSceneGenerationJob(jobId: string): SceneGenerationJobRecord | null {
  return mapJob(getDbInstance().prepare(`${JOB_SELECT} WHERE j.id = ?`).get(jobId));
}

export function listResumableSceneGenerationJobs(limit = 50): SceneGenerationJobRecord[] {
  return getDbInstance()
    .prepare(`${JOB_SELECT} WHERE j.status IN ('QUEUED','PROCESSING','RETRYING','DOWNLOADING')
      AND (j.next_poll_at IS NULL OR j.next_poll_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      AND (j.next_retry_at IS NULL OR j.next_retry_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ORDER BY j.updated_at LIMIT ?`)
    .all(Math.min(Math.max(limit, 1), 500))
    .map(mapJob)
    .filter((job): job is SceneGenerationJobRecord => job !== null);
}

export function transitionSceneGenerationJob(input: {
  jobId: string;
  status: SceneStatus;
  statusMessage?: string | null;
  providerTaskId?: string | null;
  nextPollAt?: string | null;
  nextRetryAt?: string | null;
  incrementAttempt?: boolean;
  rawResponse?: unknown;
}): SceneGenerationJobRecord {
  const current = getSceneGenerationJob(input.jobId);
  if (!current) throw new Error("Scene generation job not found.");
  assertSceneTransition(current.status, input.status);
  const raw = input.rawResponse === undefined ? null : JSON.stringify(sanitizeProviderPayload(input.rawResponse));
  const db = getDbInstance();
  db.transaction(() => {
    db.prepare(
      `UPDATE scene_generation_jobs SET status = ?, status_message = ?, provider_task_id = COALESCE(?, provider_task_id),
       next_poll_at = ?, next_retry_at = ?, attempt_count = attempt_count + ?,
       submitted_at = CASE WHEN ? = 'SUBMITTING' AND submitted_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE submitted_at END,
       completed_at = CASE WHEN ? = 'COMPLETED' THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE completed_at END,
       cancelled_at = CASE WHEN ? = 'CANCELLED' THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE cancelled_at END,
       raw_response_json = COALESCE(?, raw_response_json),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(
      input.status,
      input.statusMessage ?? null,
      input.providerTaskId ?? null,
      input.nextPollAt ?? null,
      input.nextRetryAt ?? null,
      input.incrementAttempt ? 1 : 0,
      input.status,
      input.status,
      input.status,
      raw,
      input.jobId
    );
    db.prepare(
      `UPDATE project_scenes SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(input.status, current.sceneId);
  })();
  const updated = getSceneGenerationJob(input.jobId);
  if (!updated) throw new Error("Scene generation job disappeared after update.");
  return updated;
}

export function recordSceneGenerationFailure(input: {
  jobId: string;
  status: "RETRYING" | "FAILED";
  errorKind: RetryErrorKind;
  errorCode: string;
  errorMessage: string;
  nextRetryAt?: string | null;
  useFallback?: boolean;
}): SceneGenerationJobRecord {
  const current = getSceneGenerationJob(input.jobId);
  if (!current) throw new Error("Scene generation job not found.");
  assertSceneTransition(current.status, input.status);
  const history = [...current.errorHistory, {
    at: new Date().toISOString(),
    attempt: current.attemptCount,
    kind: input.errorKind,
    code: input.errorCode,
    message: input.errorMessage.slice(0, 2_000),
  }];
  const useFallback = input.useFallback === true && Boolean(
    current.fallbackProviderId && current.fallbackModelId
  );
  const nextProviderId = useFallback ? current.fallbackProviderId! : current.providerId;
  const nextModelId = useFallback ? current.fallbackModelId! : current.modelId;
  const nextIdempotencyKey = useFallback
    ? createHash("sha256")
        .update(`${current.id}:fallback:${nextProviderId}:${nextModelId}:${current.attemptCount}`)
        .digest("hex")
    : current.idempotencyKey;
  getDbInstance().transaction(() => {
    getDbInstance().prepare(
      `UPDATE scene_generation_jobs SET status = ?, error_code = ?, error_message = ?,
       error_history_json = ?, next_retry_at = ?, status_message = ?,
       provider_id = ?, model_id = ?, idempotency_key = ?, provider_task_id = NULL,
       next_poll_at = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(
      input.status,
      input.errorCode,
      input.errorMessage.slice(0, 2_000),
      JSON.stringify(history),
      input.nextRetryAt ?? null,
      input.status === "RETRYING"
        ? useFallback
          ? "Waiting to retry with compatible fallback provider"
          : "Waiting to retry"
        : "Generation failed",
      nextProviderId,
      nextModelId,
      nextIdempotencyKey,
      input.jobId
    );
    getDbInstance().prepare(
      `UPDATE project_scenes SET status = ?, last_error_code = ?, last_error_message = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(input.status, input.errorCode, input.errorMessage.slice(0, 2_000), current.sceneId);
  })();
  return getSceneGenerationJob(input.jobId)!;
}

export function saveSceneOutput(input: {
  jobId: string;
  outputUrl?: string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
  costUsd?: number | null;
  metadata?: Record<string, unknown>;
  rawResponse?: unknown;
}): SceneOutputRecord {
  const job = getSceneGenerationJob(input.jobId);
  if (!job) throw new Error("Scene generation job not found.");
  if (!input.outputUrl && !input.storageKey) throw new Error("A provider output URL or storage key is required.");
  if (input.outputUrl) validateProviderOutputUrl(input.outputUrl);
  const id = randomUUID();
  const db = getDbInstance();
  db.transaction(() => {
    db.prepare("UPDATE scene_outputs SET is_current = 0 WHERE scene_id = ?").run(job.sceneId);
    db.prepare(
      `INSERT INTO scene_outputs (
        id, project_id, scene_id, generation_job_id, provider_task_id,
        output_url, storage_key, mime_type, duration_seconds, provider_id,
        model_id, cost_usd, metadata_json, raw_response_json, is_current
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      id, job.projectId, job.sceneId, job.id, job.providerTaskId,
      input.outputUrl ?? null, input.storageKey ?? null, input.mimeType ?? null,
      input.durationSeconds ?? null, job.providerId, job.modelId, input.costUsd ?? null,
      JSON.stringify(sanitizeProviderPayload(input.metadata ?? {})),
      JSON.stringify(sanitizeProviderPayload(input.rawResponse ?? {}))
    );
    db.prepare(
      `UPDATE scene_generation_jobs SET status = 'COMPLETED', actual_cost_usd = COALESCE(?, actual_cost_usd),
       completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), status_message = 'Completed',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(input.costUsd ?? null, job.id);
    db.prepare(
      `UPDATE project_scenes SET status = 'COMPLETED', last_error_code = NULL, last_error_message = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(job.sceneId);
    const progress = db.prepare(
      `SELECT COUNT(*) AS total,
       SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed
       FROM project_scenes WHERE project_id = ?`
    ).get(job.projectId) as { total?: unknown; completed?: unknown } | undefined;
    const total = Number(progress?.total ?? 0);
    const completed = Number(progress?.completed ?? 0);
    const projectStatus = total === 33 && completed === 33
      ? "READY_TO_RENDER"
      : completed > 0
        ? "PARTIALLY_COMPLETED"
        : "GENERATING";
    db.prepare(
      `UPDATE video_projects SET status = ?, last_error_code = NULL, last_error_message = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(projectStatus, job.projectId);
  })();
  const row = rowToCamel(db.prepare("SELECT * FROM scene_outputs WHERE id = ?").get(id)) as Record<string, unknown>;
  return {
    id: String(row.id), projectId: String(row.projectId), sceneId: String(row.sceneId), generationJobId: String(row.generationJobId),
    providerTaskId: nullableString(row.providerTaskId), outputUrl: nullableString(row.outputUrl), storageKey: nullableString(row.storageKey),
    mimeType: nullableString(row.mimeType), durationSeconds: nullableNumber(row.durationSeconds), providerId: String(row.providerId),
    modelId: String(row.modelId), costUsd: nullableNumber(row.costUsd), metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {}, createdAt: String(row.createdAt),
  };
}

export function cancelSceneGenerationJob(jobId: string): SceneGenerationJobRecord {
  const job = getSceneGenerationJob(jobId);
  if (!job) throw new Error("Scene generation job not found.");
  if (job.status === "COMPLETED") throw new Error("A completed scene job cannot be cancelled.");
  return transitionSceneGenerationJob({ jobId, status: "CANCELLED", statusMessage: "Cancelled by user" });
}

export function restartSceneGenerationJob(jobId: string): SceneGenerationJobRecord {
  const source = getSceneGenerationJob(jobId);
  if (!source) throw new Error("Scene generation job not found.");
  if (!["FAILED", "CANCELLED", "COMPLETED"].includes(source.status)) {
    throw new Error("Only failed, cancelled or completed scene jobs can be restarted.");
  }
  const id = randomUUID();
  const idempotencyKey = createHash("sha256")
    .update(`${source.id}:manual-restart:${id}`)
    .digest("hex");
  const db = getDbInstance();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO scene_generation_jobs (
        id, project_id, scene_id, prompt_version_id, provider_id, model_id,
        idempotency_key, status, maximum_attempts, fallback_provider_id,
        fallback_model_id, status_message, error_history_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', 3, ?, ?, ?, ?)`
    ).run(
      id,
      source.projectId,
      source.sceneId,
      source.promptVersionId,
      source.providerId,
      source.modelId,
      idempotencyKey,
      source.fallbackProviderId,
      source.fallbackModelId,
      source.status === "COMPLETED" ? "Queued for explicit regeneration" : "Queued for manual retry",
      JSON.stringify([
        {
          at: new Date().toISOString(),
          kind: "MANUAL_RESTART",
          sourceJobId: source.id,
          sourceStatus: source.status,
        },
      ])
    );
    db.prepare(
      `UPDATE project_scenes SET status = 'QUEUED', last_error_code = NULL,
       last_error_message = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(source.sceneId);
    db.prepare(
      `UPDATE video_projects SET status = 'GENERATING', last_error_code = NULL,
       last_error_message = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(source.projectId);
  })();
  const restarted = getSceneGenerationJob(id);
  if (!restarted) throw new Error("Restarted scene job was not persisted.");
  return restarted;
}
