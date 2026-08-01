import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const migration = readFileSync(
  new URL("../../src/lib/db/migrations/134_bijoy_video_maker.sql", import.meta.url),
  "utf8"
);

function id(prefix: string, value: number | string): string {
  return `${prefix}-${String(value).padStart(3, "0")}`;
}

function openDatabase(file: string): DatabaseSync {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

test("video project, avatar, 33 jobs and render state survive a database restart", () => {
  const root = mkdtempSync(path.join(tmpdir(), "bijoy-video-maker-db-"));
  const file = path.join(root, "storage.sqlite");
  try {
    let db = openDatabase(file);
    db.exec(migration);

    db.prepare(
      `INSERT INTO avatar_profiles (
        id, name, default_clothing_description, default_studio_description,
        default_visual_style, language, accent, default_call_to_action
      ) VALUES (?, ?, ?, ?, ?, 'bn', ?, ?)`
    ).run(
      "avatar-001",
      "Bijoy Presenter",
      "Black jacket and dark shirt",
      "Dark navy technology studio",
      "Realistic YouTube Presenter",
      "Bangla (Bangladesh)",
      "Subscribe to BigShortAds"
    );
    db.prepare(
      `INSERT INTO avatar_assets (
        id, avatar_profile_id, asset_role, storage_key, original_filename,
        mime_type, byte_size, width, height, sha256
      ) VALUES (?, ?, 'FRONT', ?, ?, 'image/png', 128, 1024, 1024, ?)`
    ).run("asset-001", "avatar-001", "avatar-001/front-safe.png", "presenter.png", "a".repeat(64));

    db.prepare(
      `INSERT INTO video_projects (
        id, name, video_title, status, avatar_profile_id, current_master_prompt_id
      ) VALUES (?, ?, ?, 'PLAN_READY', ?, ?)`
    ).run("project-001", "Facebook Credit Line", "How to Apply for a Facebook Ads Credit Line?", "avatar-001", "master-001");
    db.prepare(
      `INSERT INTO video_project_settings (
        project_id, language, video_type, llm_model_id, visual_style,
        aspect_ratio, scene_count, scene_duration_seconds, width, height,
        audio_mode, settings_json
      ) VALUES (?, 'bn', 'YOUTUBE_TUTORIAL', 'mock/llm', ?, '16:9', 33, 10, 1920, 1080, 'NATIVE_VIDEO_AUDIO', '{}')`
    ).run("project-001", "Realistic YouTube Presenter");
    db.prepare(
      `INSERT INTO project_master_prompts (
        id, project_id, version, prompt_text, source_model, source_provider,
        is_current, validation_json
      ) VALUES (?, ?, 1, ?, 'mock/llm', 'mock', 1, '{"ok":true}')`
    ).run("master-001", "project-001", "Master Prompt");

    for (let sceneNumber = 1; sceneNumber <= 33; sceneNumber += 1) {
      const sceneId = id("scene", sceneNumber);
      const promptId = id("prompt", sceneNumber);
      const scenePlan = JSON.stringify({
        sceneNumber,
        title: `Scene ${sceneNumber}`,
        purpose: `Unique purpose ${sceneNumber}`,
        durationSeconds: 10,
        exactDialogue: `Unique dialogue ${sceneNumber}`,
      });
      db.prepare(
        `INSERT INTO project_scenes (
          id, project_id, scene_number, title, purpose, duration_seconds,
          exact_dialogue, scene_plan_json, status, current_prompt_version_id,
          locked, sort_order
        ) VALUES (?, ?, ?, ?, ?, 10, ?, ?, 'QUEUED', ?, 0, ?)`
      ).run(
        sceneId,
        "project-001",
        sceneNumber,
        `Scene ${sceneNumber}`,
        `Unique purpose ${sceneNumber}`,
        `Unique dialogue ${sceneNumber}`,
        scenePlan,
        promptId,
        sceneNumber
      );
      db.prepare(
        `INSERT INTO scene_prompt_versions (
          id, scene_id, version, prompt_text, exact_dialogue,
          compiled_from_master_prompt_id, source_provider, source_model
        ) VALUES (?, ?, 1, ?, ?, 'master-001', 'mock', 'mock/video')`
      ).run(promptId, sceneId, `Self-contained prompt ${sceneNumber}`, `Unique dialogue ${sceneNumber}`);
      db.prepare(
        `INSERT INTO scene_generation_jobs (
          id, project_id, scene_id, prompt_version_id, provider_id, model_id,
          provider_task_id, idempotency_key, status, attempt_count,
          maximum_attempts, status_message
        ) VALUES (?, 'project-001', ?, ?, 'mock-video', 'mock-i2v', ?, ?, 'PROCESSING', 1, 3, 'Provider processing')`
      ).run(id("job", sceneNumber), sceneId, promptId, id("task", sceneNumber), id("idem", sceneNumber));
    }

    db.close();
    db = openDatabase(file);
    const persisted = db.prepare(
      `SELECT COUNT(*) AS count FROM scene_generation_jobs
       WHERE project_id = 'project-001' AND status = 'PROCESSING' AND provider_task_id IS NOT NULL`
    ).get() as { count: number };
    assert.equal(Number(persisted.count), 33);
    assert.equal(
      Number((db.prepare("SELECT COUNT(*) AS count FROM project_scenes WHERE project_id = 'project-001'").get() as { count: number }).count),
      33
    );

    for (let sceneNumber = 1; sceneNumber <= 33; sceneNumber += 1) {
      db.prepare(
        `INSERT INTO scene_outputs (
          id, project_id, scene_id, generation_job_id, provider_task_id,
          output_kind, output_url, mime_type, width, height, duration_seconds,
          provider_id, model_id, metadata_json, raw_response_json, is_current
        ) VALUES (?, 'project-001', ?, ?, ?, 'VIDEO', ?, 'video/mp4', 1920, 1080, 10,
          'mock-video', 'mock-i2v', '{}', '{}', 1)`
      ).run(
        id("output", sceneNumber),
        id("scene", sceneNumber),
        id("job", sceneNumber),
        id("task", sceneNumber),
        `https://media.example.test/scene-${sceneNumber}.mp4`
      );
      db.prepare("UPDATE project_scenes SET status = 'COMPLETED' WHERE id = ?").run(id("scene", sceneNumber));
      db.prepare("UPDATE scene_generation_jobs SET status = 'COMPLETED' WHERE id = ?").run(id("job", sceneNumber));
    }
    const duration = db.prepare(
      "SELECT SUM(duration_seconds) AS total FROM scene_outputs WHERE project_id = 'project-001' AND is_current = 1"
    ).get() as { total: number };
    assert.equal(Number(duration.total), 330);

    db.prepare(
      `INSERT INTO project_render_jobs (
        id, project_id, provider_id, model_id, provider_task_id,
        idempotency_key, status, timeline_json, options_json,
        expected_duration_seconds, status_message
      ) VALUES ('render-001', 'project-001', 'mock-render', 'timeline-v1', 'render-task-001',
        'render-idempotency-001', 'PROCESSING', ?, '{}', 330, 'Cloud render processing')`
    ).run(JSON.stringify({ clips: Array.from({ length: 33 }, (_, index) => ({ sceneNumber: index + 1, durationSeconds: 10 })) }));
    db.prepare(
      "UPDATE video_projects SET status = 'RENDERING', current_render_job_id = 'render-001' WHERE id = 'project-001'"
    ).run();
    db.close();

    db = openDatabase(file);
    const render = db.prepare(
      "SELECT provider_task_id, expected_duration_seconds FROM project_render_jobs WHERE id = 'render-001'"
    ).get() as { provider_task_id: string; expected_duration_seconds: number };
    assert.equal(render.provider_task_id, "render-task-001");
    assert.equal(Number(render.expected_duration_seconds), 330);

    db.prepare("DELETE FROM video_projects WHERE id = 'project-001'").run();
    for (const table of [
      "video_project_settings",
      "project_master_prompts",
      "project_scenes",
      "scene_prompt_versions",
      "scene_generation_jobs",
      "scene_outputs",
      "project_render_jobs",
    ]) {
      assert.equal(Number((db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count), 0, table);
    }
    assert.equal(Number((db.prepare("SELECT COUNT(*) AS count FROM avatar_profiles").get() as { count: number }).count), 1);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    db.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
