import { randomUUID } from "node:crypto";
import { getDbInstance, rowToCamel } from "./core";
import {
  VIDEO_PROJECT_STATUSES,
  type VideoProjectStatus,
} from "@/domain/videoMaker/types";
import { assertBijoyDefaultDuration } from "@/domain/videoMaker/duration";

export interface CreateVideoProjectInput {
  name?: string;
  videoTitle: string;
  avatarProfileId?: string | null;
  language?: string;
  videoType?: string;
  llmModelId?: string | null;
  voiceProviderId?: string | null;
  voiceModelId?: string | null;
  videoProviderId?: string | null;
  videoModelId?: string | null;
  imageProviderId?: string | null;
  imageModelId?: string | null;
  musicProviderId?: string | null;
  musicModelId?: string | null;
  renderProviderId?: string | null;
  renderModelId?: string | null;
  visualStyle?: string;
  aspectRatio?: string;
  sceneCount?: number;
  sceneDurationSeconds?: number;
  width?: number;
  height?: number;
  audioMode?: "NATIVE_VIDEO_AUDIO" | "SEPARATE_API_VOICE";
  channelBrandingEnabled?: boolean;
  sourceMaterial?: string | null;
  settings?: Record<string, unknown>;
}

export interface VideoProjectSettingsRecord {
  projectId: string;
  language: string;
  videoType: string;
  llmModelId: string | null;
  voiceProviderId: string | null;
  voiceModelId: string | null;
  videoProviderId: string | null;
  videoModelId: string | null;
  imageProviderId: string | null;
  imageModelId: string | null;
  musicProviderId: string | null;
  musicModelId: string | null;
  renderProviderId: string | null;
  renderModelId: string | null;
  visualStyle: string;
  aspectRatio: string;
  sceneCount: number;
  sceneDurationSeconds: number;
  width: number;
  height: number;
  audioMode: "NATIVE_VIDEO_AUDIO" | "SEPARATE_API_VOICE";
  channelBrandingEnabled: boolean;
  sourceMaterial: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VideoProjectRecord {
  id: string;
  name: string;
  videoTitle: string;
  status: VideoProjectStatus;
  avatarProfileId: string | null;
  currentMasterPromptId: string | null;
  currentRenderJobId: string | null;
  finalOutputUrl: string | null;
  finalOutputStorageKey: string | null;
  finalDurationSeconds: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  settings?: VideoProjectSettingsRecord | null;
}

export interface ListVideoProjectsOptions {
  status?: VideoProjectStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

function asRecord(row: unknown): Record<string, unknown> | null {
  return rowToCamel(row) as Record<string, unknown> | null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toSettings(row: unknown): VideoProjectSettingsRecord | null {
  const mapped = asRecord(row);
  if (!mapped) return null;
  return {
    projectId: String(mapped.projectId),
    language: String(mapped.language),
    videoType: String(mapped.videoType),
    llmModelId: stringOrNull(mapped.llmModelId),
    voiceProviderId: stringOrNull(mapped.voiceProviderId),
    voiceModelId: stringOrNull(mapped.voiceModelId),
    videoProviderId: stringOrNull(mapped.videoProviderId),
    videoModelId: stringOrNull(mapped.videoModelId),
    imageProviderId: stringOrNull(mapped.imageProviderId),
    imageModelId: stringOrNull(mapped.imageModelId),
    musicProviderId: stringOrNull(mapped.musicProviderId),
    musicModelId: stringOrNull(mapped.musicModelId),
    renderProviderId: stringOrNull(mapped.renderProviderId),
    renderModelId: stringOrNull(mapped.renderModelId),
    visualStyle: String(mapped.visualStyle),
    aspectRatio: String(mapped.aspectRatio),
    sceneCount: Number(mapped.sceneCount),
    sceneDurationSeconds: Number(mapped.sceneDurationSeconds),
    width: Number(mapped.width),
    height: Number(mapped.height),
    audioMode: mapped.audioMode as VideoProjectSettingsRecord["audioMode"],
    channelBrandingEnabled:
      mapped.channelBrandingEnabled === true || mapped.channelBrandingEnabled === 1,
    sourceMaterial: stringOrNull(mapped.sourceMaterial),
    settings:
      mapped.settings && typeof mapped.settings === "object"
        ? (mapped.settings as Record<string, unknown>)
        : {},
    createdAt: String(mapped.createdAt),
    updatedAt: String(mapped.updatedAt),
  };
}

function toProject(row: unknown): VideoProjectRecord | null {
  const mapped = asRecord(row);
  if (!mapped) return null;
  return {
    id: String(mapped.id),
    name: String(mapped.name),
    videoTitle: String(mapped.videoTitle),
    status: mapped.status as VideoProjectStatus,
    avatarProfileId: stringOrNull(mapped.avatarProfileId),
    currentMasterPromptId: stringOrNull(mapped.currentMasterPromptId),
    currentRenderJobId: stringOrNull(mapped.currentRenderJobId),
    finalOutputUrl: stringOrNull(mapped.finalOutputUrl),
    finalOutputStorageKey: stringOrNull(mapped.finalOutputStorageKey),
    finalDurationSeconds:
      typeof mapped.finalDurationSeconds === "number"
        ? mapped.finalDurationSeconds
        : mapped.finalDurationSeconds == null
          ? null
          : Number(mapped.finalDurationSeconds),
    lastErrorCode: stringOrNull(mapped.lastErrorCode),
    lastErrorMessage: stringOrNull(mapped.lastErrorMessage),
    createdAt: String(mapped.createdAt),
    updatedAt: String(mapped.updatedAt),
  };
}

function normalizeStatus(value: string): VideoProjectStatus {
  if (!VIDEO_PROJECT_STATUSES.includes(value as VideoProjectStatus)) {
    throw new Error(`Unsupported video project status: ${value}`);
  }
  return value as VideoProjectStatus;
}

export function createVideoProject(input: CreateVideoProjectInput): VideoProjectRecord {
  const videoTitle = input.videoTitle.trim();
  if (!videoTitle) throw new Error("Video title is required.");

  const sceneCount = input.sceneCount ?? 33;
  const sceneDurationSeconds = input.sceneDurationSeconds ?? 10;
  assertBijoyDefaultDuration(sceneCount, sceneDurationSeconds);

  const projectId = randomUUID();
  const projectName = input.name?.trim() || videoTitle;
  const db = getDbInstance();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO video_projects (
        id, name, video_title, status, avatar_profile_id
      ) VALUES (?, ?, ?, 'DRAFT', ?)`
    ).run(projectId, projectName, videoTitle, input.avatarProfileId ?? null);

    db.prepare(
      `INSERT INTO video_project_settings (
        project_id, language, video_type, llm_model_id,
        voice_provider_id, voice_model_id,
        video_provider_id, video_model_id,
        image_provider_id, image_model_id,
        music_provider_id, music_model_id,
        render_provider_id, render_model_id,
        visual_style, aspect_ratio, scene_count, scene_duration_seconds,
        width, height, audio_mode, channel_branding_enabled,
        source_material, settings_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      projectId,
      input.language ?? "bn",
      input.videoType ?? "YOUTUBE_TUTORIAL",
      input.llmModelId ?? null,
      input.voiceProviderId ?? null,
      input.voiceModelId ?? null,
      input.videoProviderId ?? null,
      input.videoModelId ?? null,
      input.imageProviderId ?? null,
      input.imageModelId ?? null,
      input.musicProviderId ?? null,
      input.musicModelId ?? null,
      input.renderProviderId ?? null,
      input.renderModelId ?? null,
      input.visualStyle ?? "Realistic YouTube Presenter",
      input.aspectRatio ?? "16:9",
      sceneCount,
      sceneDurationSeconds,
      input.width ?? 1920,
      input.height ?? 1080,
      input.audioMode ?? "NATIVE_VIDEO_AUDIO",
      input.channelBrandingEnabled ? 1 : 0,
      input.sourceMaterial?.trim() || null,
      JSON.stringify(input.settings ?? {})
    );
  })();

  const created = getVideoProject(projectId);
  if (!created) throw new Error("Video project was not persisted.");
  return created;
}

export function listVideoProjects(options: ListVideoProjectsOptions = {}): VideoProjectRecord[] {
  const db = getDbInstance();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (options.status) {
    clauses.push("status = ?");
    params.push(normalizeStatus(options.status));
  }
  const search = options.search?.trim();
  if (search) {
    clauses.push("(name LIKE ? ESCAPE '\\' OR video_title LIKE ? ESCAPE '\\')");
    const escaped = search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
    params.push(`%${escaped}%`, `%${escaped}%`);
  }

  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 100), 1), 500);
  const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(limit, offset);

  return db
    .prepare(
      `SELECT * FROM video_projects ${where}
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params)
    .map((row) => toProject(row))
    .filter((row): row is VideoProjectRecord => row !== null);
}

export function getVideoProject(projectId: string): VideoProjectRecord | null {
  const db = getDbInstance();
  const project = toProject(db.prepare("SELECT * FROM video_projects WHERE id = ?").get(projectId));
  if (!project) return null;
  project.settings = toSettings(
    db.prepare("SELECT * FROM video_project_settings WHERE project_id = ?").get(projectId)
  );
  return project;
}

export function renameVideoProject(projectId: string, name: string): VideoProjectRecord | null {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Project name is required.");
  const db = getDbInstance();
  const result = db
    .prepare(
      `UPDATE video_projects
       SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    )
    .run(trimmed, projectId);
  return result.changes > 0 ? getVideoProject(projectId) : null;
}

export function duplicateVideoProject(
  projectId: string,
  requestedName?: string
): VideoProjectRecord {
  const source = getVideoProject(projectId);
  if (!source || !source.settings) throw new Error("Video project not found.");
  const settings = source.settings;
  const duplicate = createVideoProject({
    name: requestedName?.trim() || `${source.name} Copy`,
    videoTitle: source.videoTitle,
    avatarProfileId: source.avatarProfileId,
    language: settings.language,
    videoType: settings.videoType,
    llmModelId: settings.llmModelId,
    voiceProviderId: settings.voiceProviderId,
    voiceModelId: settings.voiceModelId,
    videoProviderId: settings.videoProviderId,
    videoModelId: settings.videoModelId,
    imageProviderId: settings.imageProviderId,
    imageModelId: settings.imageModelId,
    musicProviderId: settings.musicProviderId,
    musicModelId: settings.musicModelId,
    renderProviderId: settings.renderProviderId,
    renderModelId: settings.renderModelId,
    visualStyle: settings.visualStyle,
    aspectRatio: settings.aspectRatio,
    sceneCount: settings.sceneCount,
    sceneDurationSeconds: settings.sceneDurationSeconds,
    width: settings.width,
    height: settings.height,
    audioMode: settings.audioMode,
    channelBrandingEnabled: settings.channelBrandingEnabled,
    sourceMaterial: settings.sourceMaterial,
    settings: settings.settings,
  });

  const db = getDbInstance();
  try {
    db.transaction(() => {
      const master = db
        .prepare(
          `SELECT * FROM project_master_prompts
           WHERE project_id = ? AND is_current = 1
           ORDER BY version DESC LIMIT 1`
        )
        .get(projectId) as Record<string, unknown> | undefined;
      let duplicateMasterId: string | null = null;
      if (master) {
        duplicateMasterId = randomUUID();
        db.prepare(
          `INSERT INTO project_master_prompts (
            id, project_id, version, prompt_text, source_model, source_provider,
            is_current, validation_json
          ) VALUES (?, ?, 1, ?, ?, 'project-duplicate', 1, ?)`
        ).run(
          duplicateMasterId,
          duplicate.id,
          master.prompt_text,
          master.source_model ?? "duplicate",
          JSON.stringify({
            duplicatedFromProjectId: projectId,
            duplicatedFromPromptId: master.id,
          })
        );
        db.prepare(
          "UPDATE video_projects SET current_master_prompt_id = ? WHERE id = ?"
        ).run(duplicateMasterId, duplicate.id);
      }

      const scenes = db
        .prepare(
          `SELECT s.*, p.prompt_text, p.exact_dialogue AS prompt_dialogue,
           p.source_model, p.source_provider
           FROM project_scenes s
           LEFT JOIN scene_prompt_versions p ON p.id = s.current_prompt_version_id
           WHERE s.project_id = ? ORDER BY s.sort_order, s.scene_number`
        )
        .all(projectId) as Array<Record<string, unknown>>;
      for (const sourceScene of scenes) {
        const sceneId = randomUUID();
        const promptVersionId = sourceScene.prompt_text ? randomUUID() : null;
        db.prepare(
          `INSERT INTO project_scenes (
            id, project_id, scene_number, title, purpose, duration_seconds,
            exact_dialogue, scene_plan_json, status, current_prompt_version_id,
            locked, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
        ).run(
          sceneId,
          duplicate.id,
          sourceScene.scene_number,
          sourceScene.title,
          sourceScene.purpose,
          sourceScene.duration_seconds,
          sourceScene.exact_dialogue,
          sourceScene.scene_plan_json,
          promptVersionId ? "PROMPT_READY" : "DRAFT",
          promptVersionId,
          sourceScene.sort_order
        );
        if (promptVersionId) {
          db.prepare(
            `INSERT INTO scene_prompt_versions (
              id, scene_id, version, prompt_text, exact_dialogue,
              compiled_from_master_prompt_id, source_provider, source_model
            ) VALUES (?, ?, 1, ?, ?, ?, 'project-duplicate', ?)`
          ).run(
            promptVersionId,
            sceneId,
            sourceScene.prompt_text,
            sourceScene.prompt_dialogue ?? sourceScene.exact_dialogue,
            duplicateMasterId,
            sourceScene.source_model ?? "duplicate"
          );
        }
      }
      db.prepare(
        `UPDATE video_projects SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      ).run(scenes.length === 33 ? "PLAN_READY" : "DRAFT", duplicate.id);
    })();
  } catch (error) {
    deleteVideoProject(duplicate.id);
    throw error;
  }
  const cloned = getVideoProject(duplicate.id);
  if (!cloned) throw new Error("Duplicated project was not persisted.");
  return cloned;
}

export function setVideoProjectStatus(
  projectId: string,
  status: VideoProjectStatus,
  error?: { code?: string | null; message?: string | null }
): VideoProjectRecord | null {
  const normalizedStatus = normalizeStatus(status);
  const db = getDbInstance();
  const result = db
    .prepare(
      `UPDATE video_projects
       SET status = ?, last_error_code = ?, last_error_message = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    )
    .run(normalizedStatus, error?.code ?? null, error?.message ?? null, projectId);
  return result.changes > 0 ? getVideoProject(projectId) : null;
}

export function deleteVideoProject(projectId: string): boolean {
  const db = getDbInstance();
  return db.prepare("DELETE FROM video_projects WHERE id = ?").run(projectId).changes > 0;
}

export interface DashboardVideoProjectStats {
  totalProjects: number;
  activeGenerations: number;
  failedScenes: number;
  completedVideos: number;
  estimatedCostUsd: number;
  recentProjects: VideoProjectRecord[];
}

export function getVideoMakerDashboardStats(): DashboardVideoProjectStats {
  const db = getDbInstance();
  const projects = db
    .prepare(
      `SELECT
         COUNT(*) AS total_projects,
         SUM(CASE WHEN status IN ('GENERATING', 'RENDERING') THEN 1 ELSE 0 END) AS active_generations,
         SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_videos
       FROM video_projects`
    )
    .get() as Record<string, unknown> | undefined;
  const failedScenes = db
    .prepare("SELECT COUNT(*) AS count FROM project_scenes WHERE status = 'FAILED'")
    .get() as Record<string, unknown> | undefined;
  const estimatedCost = db
    .prepare("SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total FROM project_usage")
    .get() as Record<string, unknown> | undefined;

  return {
    totalProjects: Number(projects?.total_projects ?? 0),
    activeGenerations: Number(projects?.active_generations ?? 0),
    failedScenes: Number(failedScenes?.count ?? 0),
    completedVideos: Number(projects?.completed_videos ?? 0),
    estimatedCostUsd: Number(estimatedCost?.total ?? 0),
    recentProjects: listVideoProjects({ limit: 6 }),
  };
}
