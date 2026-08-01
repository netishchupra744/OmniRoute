import { randomUUID } from "node:crypto";
import { getDbInstance, rowToCamel } from "./core";
import { validateScenePlan } from "@/domain/videoMaker/scenePlanValidation";
import type { ScenePlan } from "@/domain/videoMaker/types";

export interface MasterPromptVersionRecord {
  id: string;
  projectId: string;
  version: number;
  promptText: string;
  sourceModel: string | null;
  sourceProvider: string | null;
  isCurrent: boolean;
  validation: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectSceneRecord {
  id: string;
  projectId: string;
  sceneNumber: number;
  title: string;
  purpose: string;
  durationSeconds: number;
  exactDialogue: string;
  scenePlan: ScenePlan;
  status: string;
  currentPromptVersionId: string | null;
  currentPromptText: string | null;
  promptVersion: number | null;
  locked: boolean;
  sortOrder: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScenePromptVersionRecord {
  id: string;
  sceneId: string;
  version: number;
  promptText: string;
  exactDialogue: string;
  compiledFromMasterPromptId: string | null;
  sourceProvider: string | null;
  sourceModel: string | null;
  isCurrent: boolean;
  createdAt: string;
}

function mapMaster(row: unknown): MasterPromptVersionRecord | null {
  const mapped = rowToCamel(row) as Record<string, unknown> | null;
  if (!mapped) return null;
  return {
    id: String(mapped.id),
    projectId: String(mapped.projectId),
    version: Number(mapped.version),
    promptText: String(mapped.promptText),
    sourceModel: typeof mapped.sourceModel === "string" ? mapped.sourceModel : null,
    sourceProvider: typeof mapped.sourceProvider === "string" ? mapped.sourceProvider : null,
    isCurrent: mapped.isCurrent === 1 || mapped.isCurrent === true,
    validation:
      mapped.validation && typeof mapped.validation === "object"
        ? (mapped.validation as Record<string, unknown>)
        : {},
    createdAt: String(mapped.createdAt),
  };
}

function parseScene(value: unknown): ScenePlan {
  if (value && typeof value === "object") return value as ScenePlan;
  throw new Error("Stored scene plan JSON is invalid.");
}

function mapScene(row: unknown): ProjectSceneRecord | null {
  const mapped = rowToCamel(row) as Record<string, unknown> | null;
  if (!mapped) return null;
  return {
    id: String(mapped.id),
    projectId: String(mapped.projectId),
    sceneNumber: Number(mapped.sceneNumber),
    title: String(mapped.title),
    purpose: String(mapped.purpose),
    durationSeconds: Number(mapped.durationSeconds),
    exactDialogue: String(mapped.exactDialogue),
    scenePlan: parseScene(mapped.scenePlan),
    status: String(mapped.status),
    currentPromptVersionId:
      typeof mapped.currentPromptVersionId === "string" ? mapped.currentPromptVersionId : null,
    currentPromptText:
      typeof mapped.currentPromptText === "string" ? mapped.currentPromptText : null,
    promptVersion:
      mapped.promptVersion == null ? null : Number(mapped.promptVersion),
    locked: mapped.locked === 1 || mapped.locked === true,
    sortOrder: Number(mapped.sortOrder),
    lastErrorCode: typeof mapped.lastErrorCode === "string" ? mapped.lastErrorCode : null,
    lastErrorMessage: typeof mapped.lastErrorMessage === "string" ? mapped.lastErrorMessage : null,
    createdAt: String(mapped.createdAt),
    updatedAt: String(mapped.updatedAt),
  };
}

function mapPromptVersion(row: unknown): ScenePromptVersionRecord | null {
  const mapped = rowToCamel(row) as Record<string, unknown> | null;
  if (!mapped) return null;
  return {
    id: String(mapped.id),
    sceneId: String(mapped.sceneId),
    version: Number(mapped.version),
    promptText: String(mapped.promptText),
    exactDialogue: String(mapped.exactDialogue),
    compiledFromMasterPromptId:
      typeof mapped.compiledFromMasterPromptId === "string"
        ? mapped.compiledFromMasterPromptId
        : null,
    sourceProvider:
      typeof mapped.sourceProvider === "string" ? mapped.sourceProvider : null,
    sourceModel: typeof mapped.sourceModel === "string" ? mapped.sourceModel : null,
    isCurrent: mapped.isCurrent === 1 || mapped.isCurrent === true,
    createdAt: String(mapped.createdAt),
  };
}

export function saveMasterPromptVersion(input: {
  projectId: string;
  promptText: string;
  sourceModel: string;
  sourceProvider?: string | null;
  validation: Record<string, unknown>;
}): MasterPromptVersionRecord {
  const db = getDbInstance();
  const id = randomUUID();
  db.transaction(() => {
    const versionRow = db
      .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM project_master_prompts WHERE project_id = ?")
      .get(input.projectId) as Record<string, unknown> | undefined;
    const version = Number(versionRow?.version ?? 0) + 1;
    db.prepare("UPDATE project_master_prompts SET is_current = 0 WHERE project_id = ?").run(
      input.projectId
    );
    db.prepare(
      `INSERT INTO project_master_prompts (
        id, project_id, version, prompt_text, source_model, source_provider,
        is_current, validation_json
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(
      id,
      input.projectId,
      version,
      input.promptText,
      input.sourceModel,
      input.sourceProvider ?? input.sourceModel.split("/")[0] ?? null,
      JSON.stringify(input.validation)
    );
    db.prepare(
      `UPDATE video_projects SET current_master_prompt_id = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(id, input.projectId);
  })();
  const saved = mapMaster(
    db.prepare("SELECT * FROM project_master_prompts WHERE id = ?").get(id)
  );
  if (!saved) throw new Error("Master prompt version was not persisted.");
  return saved;
}

export function getCurrentMasterPrompt(projectId: string): MasterPromptVersionRecord | null {
  return mapMaster(
    getDbInstance()
      .prepare(
        "SELECT * FROM project_master_prompts WHERE project_id = ? AND is_current = 1 ORDER BY version DESC LIMIT 1"
      )
      .get(projectId)
  );
}

export function listMasterPromptVersions(projectId: string): MasterPromptVersionRecord[] {
  return getDbInstance()
    .prepare("SELECT * FROM project_master_prompts WHERE project_id = ? ORDER BY version DESC")
    .all(projectId)
    .map(mapMaster)
    .filter((row): row is MasterPromptVersionRecord => row !== null);
}

export function saveManualMasterPromptVersion(input: {
  projectId: string;
  promptText: string;
}): MasterPromptVersionRecord {
  const promptText = input.promptText.trim();
  if (!promptText) throw new Error("Master Prompt cannot be empty.");
  return saveMasterPromptVersion({
    projectId: input.projectId,
    promptText,
    sourceModel: "manual",
    sourceProvider: "local-user-edit",
    validation: { editedByUser: true },
  });
}

export function restoreMasterPromptVersion(input: {
  projectId: string;
  promptVersionId: string;
}): MasterPromptVersionRecord {
  const db = getDbInstance();
  const source = mapMaster(
    db
      .prepare(
        "SELECT * FROM project_master_prompts WHERE id = ? AND project_id = ?"
      )
      .get(input.promptVersionId, input.projectId)
  );
  if (!source) throw new Error("Master Prompt version not found.");
  return saveMasterPromptVersion({
    projectId: input.projectId,
    promptText: source.promptText,
    sourceModel: source.sourceModel ?? "restored",
    sourceProvider: source.sourceProvider ?? "version-restore",
    validation: {
      ...source.validation,
      restoredFromVersion: source.version,
      restoredFromPromptId: source.id,
    },
  });
}

export function saveValidatedScenePlan(input: {
  projectId: string;
  masterPromptId: string;
  scenes: ScenePlan[];
  compiledPrompts: Map<number, string>;
  sourceModel: string;
}): ProjectSceneRecord[] {
  const validation = validateScenePlan(input.scenes);
  if (!validation.ok) {
    throw new Error(`Cannot persist invalid scene plan: ${validation.errors.join("; ")}`);
  }
  const db = getDbInstance();
  db.transaction(() => {
    for (const scene of input.scenes) {
      const existing = db
        .prepare("SELECT id, locked FROM project_scenes WHERE project_id = ? AND scene_number = ?")
        .get(input.projectId, scene.sceneNumber) as Record<string, unknown> | undefined;
      if (existing && (existing.locked === 1 || existing.locked === true)) continue;

      const sceneId = typeof existing?.id === "string" ? existing.id : randomUUID();
      if (existing) {
        db.prepare(
          `UPDATE project_scenes SET title = ?, purpose = ?, duration_seconds = ?,
           exact_dialogue = ?, scene_plan_json = ?, status = 'PROMPT_READY', sort_order = ?,
           last_error_code = NULL, last_error_message = NULL,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?`
        ).run(
          scene.title,
          scene.purpose,
          scene.durationSeconds,
          scene.exactDialogue,
          JSON.stringify(scene),
          scene.sceneNumber,
          sceneId
        );
      } else {
        db.prepare(
          `INSERT INTO project_scenes (
            id, project_id, scene_number, title, purpose, duration_seconds,
            exact_dialogue, scene_plan_json, status, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PROMPT_READY', ?)`
        ).run(
          sceneId,
          input.projectId,
          scene.sceneNumber,
          scene.title,
          scene.purpose,
          scene.durationSeconds,
          scene.exactDialogue,
          JSON.stringify(scene),
          scene.sceneNumber
        );
      }

      const versionRow = db
        .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM scene_prompt_versions WHERE scene_id = ?")
        .get(sceneId) as Record<string, unknown> | undefined;
      const version = Number(versionRow?.version ?? 0) + 1;
      const promptVersionId = randomUUID();
      const promptText = input.compiledPrompts.get(scene.sceneNumber);
      if (!promptText) throw new Error(`Compiled prompt is missing for scene ${scene.sceneNumber}.`);
      db.prepare(
        `INSERT INTO scene_prompt_versions (
          id, scene_id, version, prompt_text, exact_dialogue,
          compiled_from_master_prompt_id, source_model
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        promptVersionId,
        sceneId,
        version,
        promptText,
        scene.exactDialogue,
        input.masterPromptId,
        input.sourceModel
      );
      db.prepare(
        `UPDATE project_scenes SET current_prompt_version_id = ?, status = 'PROMPT_READY',
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
      ).run(promptVersionId, sceneId);
    }
    db.prepare(
      `UPDATE video_projects SET status = 'PLAN_READY', last_error_code = NULL,
       last_error_message = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    ).run(input.projectId);
  })();
  return listProjectScenes(input.projectId);
}

export function listProjectScenes(projectId: string): ProjectSceneRecord[] {
  return getDbInstance()
    .prepare(
      `SELECT s.*, p.prompt_text AS current_prompt_text, p.version AS prompt_version
       FROM project_scenes s
       LEFT JOIN scene_prompt_versions p ON p.id = s.current_prompt_version_id
       WHERE s.project_id = ? ORDER BY s.sort_order, s.scene_number`
    )
    .all(projectId)
    .map(mapScene)
    .filter((row): row is ProjectSceneRecord => row !== null);
}

export function getProjectScene(projectId: string, sceneId: string): ProjectSceneRecord | null {
  const row = getDbInstance()
    .prepare(
      `SELECT s.*, p.prompt_text AS current_prompt_text, p.version AS prompt_version
       FROM project_scenes s
       LEFT JOIN scene_prompt_versions p ON p.id = s.current_prompt_version_id
       WHERE s.project_id = ? AND s.id = ?`
    )
    .get(projectId, sceneId);
  return mapScene(row);
}

export function listScenePromptVersions(
  projectId: string,
  sceneId: string
): ScenePromptVersionRecord[] {
  const scene = getProjectScene(projectId, sceneId);
  if (!scene) throw new Error("Scene not found.");
  return getDbInstance()
    .prepare(
      `SELECT p.*,
       CASE WHEN p.id = s.current_prompt_version_id THEN 1 ELSE 0 END AS is_current
       FROM scene_prompt_versions p
       JOIN project_scenes s ON s.id = p.scene_id
       WHERE s.project_id = ? AND p.scene_id = ?
       ORDER BY p.version DESC`
    )
    .all(projectId, sceneId)
    .map(mapPromptVersion)
    .filter((row): row is ScenePromptVersionRecord => row !== null);
}

function assertSceneEditable(scene: ProjectSceneRecord): void {
  if (scene.locked) {
    throw new Error("Unlock the scene before changing its prompt or dialogue.");
  }
  if (["SUBMITTING", "PROCESSING", "DOWNLOADING"].includes(scene.status)) {
    throw new Error("Cancel the active generation job before editing this scene.");
  }
}

function updateScenePlanDialogue(scene: ProjectSceneRecord, exactDialogue: string): ScenePlan {
  return { ...scene.scenePlan, exactDialogue };
}

export function saveScenePromptVersion(input: {
  projectId: string;
  sceneId: string;
  promptText: string;
  exactDialogue: string;
}): ProjectSceneRecord {
  const promptText = input.promptText.trim();
  const exactDialogue = input.exactDialogue.trim();
  if (!promptText) throw new Error("Scene prompt cannot be empty.");
  if (!exactDialogue) throw new Error("Scene dialogue cannot be empty.");
  if (exactDialogue.split(/\s+/u).length > 45) {
    throw new Error("Scene dialogue is too long for a ten-second scene.");
  }

  const scene = getProjectScene(input.projectId, input.sceneId);
  if (!scene) throw new Error("Scene not found.");
  assertSceneEditable(scene);
  const db = getDbInstance();
  const id = randomUUID();
  db.transaction(() => {
    const versionRow = db
      .prepare(
        "SELECT COALESCE(MAX(version), 0) AS version FROM scene_prompt_versions WHERE scene_id = ?"
      )
      .get(input.sceneId) as Record<string, unknown> | undefined;
    const version = Number(versionRow?.version ?? 0) + 1;
    db.prepare(
      `INSERT INTO scene_prompt_versions (
        id, scene_id, version, prompt_text, exact_dialogue,
        compiled_from_master_prompt_id, source_provider, source_model
      ) VALUES (?, ?, ?, ?, ?, ?, 'local-user-edit', 'manual')`
    ).run(
      id,
      input.sceneId,
      version,
      promptText,
      exactDialogue,
      scene.scenePlan ? getCurrentMasterPrompt(input.projectId)?.id ?? null : null
    );
    db.prepare(
      `UPDATE project_scenes SET current_prompt_version_id = ?, exact_dialogue = ?,
       scene_plan_json = ?, status = 'PROMPT_READY', last_error_code = NULL,
       last_error_message = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND project_id = ?`
    ).run(
      id,
      exactDialogue,
      JSON.stringify(updateScenePlanDialogue(scene, exactDialogue)),
      input.sceneId,
      input.projectId
    );
  })();
  const updated = getProjectScene(input.projectId, input.sceneId);
  if (!updated) throw new Error("Scene prompt version was not persisted.");
  return updated;
}

export function restoreScenePromptVersion(input: {
  projectId: string;
  sceneId: string;
  promptVersionId: string;
}): ProjectSceneRecord {
  const scene = getProjectScene(input.projectId, input.sceneId);
  if (!scene) throw new Error("Scene not found.");
  assertSceneEditable(scene);
  const source = listScenePromptVersions(input.projectId, input.sceneId).find(
    (version) => version.id === input.promptVersionId
  );
  if (!source) throw new Error("Scene prompt version not found.");
  return saveScenePromptVersion({
    projectId: input.projectId,
    sceneId: input.sceneId,
    promptText: source.promptText,
    exactDialogue: source.exactDialogue,
  });
}

export function setSceneLocked(sceneId: string, locked: boolean): boolean {
  return (
    getDbInstance()
      .prepare(
        `UPDATE project_scenes SET locked = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
      )
      .run(locked ? 1 : 0, sceneId).changes > 0
  );
}
