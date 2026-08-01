-- Bijoy AI Video Maker domain schema.
-- Uses OmniRoute's existing SQLite migration runner and storage.sqlite database.

CREATE TABLE IF NOT EXISTS avatar_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_clothing_description TEXT NOT NULL DEFAULT '',
  default_studio_description TEXT NOT NULL DEFAULT '',
  default_visual_style TEXT NOT NULL DEFAULT 'Realistic YouTube Presenter',
  default_voice_provider_id TEXT,
  default_voice_model_id TEXT,
  language TEXT NOT NULL DEFAULT 'bn',
  accent TEXT NOT NULL DEFAULT 'Bangla (Bangladesh)',
  channel_logo_asset_id TEXT,
  default_call_to_action TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS avatar_assets (
  id TEXT PRIMARY KEY,
  avatar_profile_id TEXT NOT NULL,
  asset_role TEXT NOT NULL CHECK (asset_role IN (
    'FRONT', 'LEFT_ANGLE', 'RIGHT_ANGLE', 'FULL_BODY', 'CHANNEL_LOGO'
  )),
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (avatar_profile_id) REFERENCES avatar_profiles(id) ON DELETE CASCADE,
  UNIQUE (avatar_profile_id, asset_role)
);

CREATE TABLE IF NOT EXISTS video_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  video_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PLANNING', 'PLAN_READY', 'GENERATING', 'PARTIALLY_COMPLETED',
    'READY_TO_RENDER', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELLED'
  )),
  avatar_profile_id TEXT,
  current_master_prompt_id TEXT,
  current_render_job_id TEXT,
  final_output_url TEXT,
  final_output_storage_key TEXT,
  final_duration_seconds REAL,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (avatar_profile_id) REFERENCES avatar_profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS video_project_settings (
  project_id TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'bn',
  video_type TEXT NOT NULL DEFAULT 'YOUTUBE_TUTORIAL',
  llm_model_id TEXT,
  voice_provider_id TEXT,
  voice_model_id TEXT,
  video_provider_id TEXT,
  video_model_id TEXT,
  image_provider_id TEXT,
  image_model_id TEXT,
  music_provider_id TEXT,
  music_model_id TEXT,
  render_provider_id TEXT,
  render_model_id TEXT,
  visual_style TEXT NOT NULL DEFAULT 'Realistic YouTube Presenter',
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  scene_count INTEGER NOT NULL DEFAULT 33 CHECK (scene_count > 0),
  scene_duration_seconds INTEGER NOT NULL DEFAULT 10 CHECK (scene_duration_seconds > 0),
  width INTEGER NOT NULL DEFAULT 1920 CHECK (width > 0),
  height INTEGER NOT NULL DEFAULT 1080 CHECK (height > 0),
  audio_mode TEXT NOT NULL DEFAULT 'NATIVE_VIDEO_AUDIO' CHECK (audio_mode IN (
    'NATIVE_VIDEO_AUDIO', 'SEPARATE_API_VOICE'
  )),
  channel_branding_enabled INTEGER NOT NULL DEFAULT 0 CHECK (channel_branding_enabled IN (0, 1)),
  source_material TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_master_prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  prompt_text TEXT NOT NULL,
  source_model TEXT,
  source_provider TEXT,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  validation_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE,
  UNIQUE (project_id, version)
);

CREATE TABLE IF NOT EXISTS project_scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_number INTEGER NOT NULL CHECK (scene_number > 0),
  title TEXT NOT NULL,
  purpose TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 10 CHECK (duration_seconds > 0),
  exact_dialogue TEXT NOT NULL,
  scene_plan_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PROMPT_READY', 'QUEUED', 'SUBMITTING', 'PROCESSING',
    'DOWNLOADING', 'COMPLETED', 'RETRYING', 'FAILED', 'CANCELLED'
  )),
  current_prompt_version_id TEXT,
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  sort_order INTEGER NOT NULL,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE,
  UNIQUE (project_id, scene_number),
  UNIQUE (project_id, sort_order)
);

CREATE TABLE IF NOT EXISTS scene_prompt_versions (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  prompt_text TEXT NOT NULL,
  exact_dialogue TEXT NOT NULL,
  compiled_from_master_prompt_id TEXT,
  source_provider TEXT,
  source_model TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (scene_id) REFERENCES project_scenes(id) ON DELETE CASCADE,
  FOREIGN KEY (compiled_from_master_prompt_id) REFERENCES project_master_prompts(id) ON DELETE SET NULL,
  UNIQUE (scene_id, version)
);

CREATE TABLE IF NOT EXISTS scene_generation_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  prompt_version_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  provider_task_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
    'QUEUED', 'SUBMITTING', 'PROCESSING', 'DOWNLOADING', 'COMPLETED',
    'RETRYING', 'FAILED', 'CANCELLED'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  maximum_attempts INTEGER NOT NULL DEFAULT 3 CHECK (maximum_attempts > 0),
  fallback_provider_id TEXT,
  fallback_model_id TEXT,
  next_poll_at TEXT,
  next_retry_at TEXT,
  submitted_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  estimated_cost_usd REAL,
  actual_cost_usd REAL,
  status_message TEXT,
  error_code TEXT,
  error_message TEXT,
  error_history_json TEXT NOT NULL DEFAULT '[]',
  raw_response_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (scene_id) REFERENCES project_scenes(id) ON DELETE CASCADE,
  FOREIGN KEY (prompt_version_id) REFERENCES scene_prompt_versions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS scene_outputs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  generation_job_id TEXT NOT NULL,
  provider_task_id TEXT,
  output_kind TEXT NOT NULL DEFAULT 'VIDEO' CHECK (output_kind IN (
    'VIDEO', 'AUDIO', 'IMAGE', 'SUBTITLE', 'OTHER'
  )),
  output_url TEXT,
  storage_key TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  width INTEGER,
  height INTEGER,
  duration_seconds REAL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  cost_usd REAL,
  checksum_sha256 TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  raw_response_json TEXT,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (scene_id) REFERENCES project_scenes(id) ON DELETE CASCADE,
  FOREIGN KEY (generation_job_id) REFERENCES scene_generation_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_render_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT,
  provider_task_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
    'QUEUED', 'SUBMITTING', 'PROCESSING', 'DOWNLOADING', 'COMPLETED',
    'RETRYING', 'FAILED', 'CANCELLED'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  maximum_attempts INTEGER NOT NULL DEFAULT 3 CHECK (maximum_attempts > 0),
  timeline_json TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '{}',
  expected_duration_seconds REAL NOT NULL DEFAULT 330,
  reported_duration_seconds REAL,
  output_url TEXT,
  output_storage_key TEXT,
  next_poll_at TEXT,
  next_retry_at TEXT,
  submitted_at TEXT,
  completed_at TEXT,
  estimated_cost_usd REAL,
  actual_cost_usd REAL,
  status_message TEXT,
  error_code TEXT,
  error_message TEXT,
  error_history_json TEXT NOT NULL DEFAULT '[]',
  raw_response_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_usage (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_id TEXT,
  generation_job_id TEXT,
  render_job_id TEXT,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  usage_kind TEXT NOT NULL CHECK (usage_kind IN (
    'LLM', 'IMAGE', 'VIDEO', 'VOICE', 'MUSIC', 'LIP_SYNC', 'FINAL_RENDER', 'DOWNLOAD'
  )),
  input_units REAL,
  output_units REAL,
  estimated_cost_usd REAL,
  actual_cost_usd REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (scene_id) REFERENCES project_scenes(id) ON DELETE SET NULL,
  FOREIGN KEY (generation_job_id) REFERENCES scene_generation_jobs(id) ON DELETE SET NULL,
  FOREIGN KEY (render_job_id) REFERENCES project_render_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_video_projects_status_updated
  ON video_projects(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_avatar_assets_profile
  ON avatar_assets(avatar_profile_id);
CREATE INDEX IF NOT EXISTS idx_master_prompts_project_current
  ON project_master_prompts(project_id, is_current, version DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_prompts_one_current
  ON project_master_prompts(project_id)
  WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS idx_project_scenes_project_status
  ON project_scenes(project_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_scene_prompt_versions_scene
  ON scene_prompt_versions(scene_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_scene_jobs_resume
  ON scene_generation_jobs(status, next_poll_at, next_retry_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_scene_jobs_scene_created
  ON scene_generation_jobs(scene_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scene_outputs_scene_current
  ON scene_outputs(scene_id, is_current, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_render_jobs_resume
  ON project_render_jobs(status, next_poll_at, next_retry_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_project_usage_project_recorded
  ON project_usage(project_id, recorded_at DESC);
