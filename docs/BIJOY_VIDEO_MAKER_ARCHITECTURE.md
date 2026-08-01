# Bijoy AI Video Maker Architecture

## Scope and audited baseline

This implementation modifies the checked-out **OmniRoute v3.8.49** source tree. It does not create a second desktop application or a separately deployed backend.

Source code is authoritative. The audit found the following reusable systems:

| Capability | Existing source evidence | Reuse decision |
|---|---|---|
| Electron Windows application | `electron/main.js`, `electron/preload.js`, `electron/package.json` | Reused and rebranded |
| Embedded local Next server | `electron/main.js` resolves and spawns the packaged server, then polls `/api/monitoring/health` | Reused; bound to `127.0.0.1` |
| Single-instance handling | `electron/main.js` `requestSingleInstanceLock` / `second-instance` | Reused |
| Process-tree shutdown | `electron/main.js` server stop and process-tree cleanup | Reused; normal window close now exits by default |
| Local database | `src/lib/db/core.ts`, `storage.sqlite` | Reused |
| Numbered SQL migrations | `src/lib/db/migrationRunner.ts`, `src/lib/db/migrations/*` | Reused; Bijoy schema is migration `134` |
| Provider connections and credentials | `src/lib/db/providerConnections.ts`, `src/lib/db/encryption.ts` | Reused; no second credential store |
| Video provider registry | `open-sse/config/videoRegistry.ts` | Reused and augmented by a conservative capability catalog |
| Video generation | `src/app/api/v1/videos/generations/route.ts` and existing handlers | Reused where provider contracts are compatible |
| Image generation/editing | `src/app/api/v1/images/generations/route.ts`, `src/app/api/v1/images/edits/route.ts` | Reused |
| Text to speech | `src/app/api/v1/audio/speech/route.ts` | Reused |
| Music generation | `src/app/api/v1/music/generations/route.ts` | Reused |
| Retry/rate-limit/credential preflight | Existing media route and provider execution infrastructure | Reused rather than duplicated |
| NSIS and portable Windows packaging | `electron/package.json` | Reused |

The current source does **not** contain a verified general-purpose endpoint that composes 33 arbitrary clips into one exact timeline. A final-render provider abstraction was therefore added without adding FFmpeg or local rendering.

## Product architecture

```text
Bijoy Electron shell
  └─ packaged OmniRoute Next server (127.0.0.1 only)
      ├─ Bijoy dashboard and project UI
      ├─ authenticated local management routes
      ├─ video-maker domain validation and prompt compilation
      ├─ existing OmniRoute LLM/media routes and provider registry
      ├─ persistent SQLite project/job state
      └─ external provider APIs
           ├─ LLM planning
           ├─ image/video/voice/music generation
           └─ cloud final-render adapter (provider contract required)
```

There is no Bijoy-operated cloud backend. External credentials remain provider credentials managed through OmniRoute.

## Added domain and persistence layers

### Domain logic

`src/domain/videoMaker/` contains:

- exact-duration rules (`33 × 10 = 330` seconds)
- Master Prompt schema/validation/repair
- 33-scene schema/validation/repair
- full self-contained scene prompt compiler
- project and scene status transitions
- retry and fallback decisions
- provider capability filtering
- exact final-render timeline construction

Malformed LLM output is never silently persisted. The planner attempts a bounded repair and records the failed attempt history when the output remains invalid.

### Database migration

`src/lib/db/migrations/134_bijoy_video_maker.sql` adds:

1. `avatar_profiles`
2. `avatar_assets`
3. `video_projects`
4. `video_project_settings`
5. `project_master_prompts`
6. `project_scenes`
7. `scene_prompt_versions`
8. `scene_generation_jobs`
9. `scene_outputs`
10. `project_render_jobs`
11. `project_usage`

Foreign keys use project ownership and cascading deletion where appropriate. Generation and render job rows contain provider task IDs, idempotency keys, attempt counts, next poll/retry times, error history and sanitized raw responses.

### Persistence modules

- `src/lib/db/videoProjects.ts`
- `src/lib/db/avatarProfiles.ts`
- `src/lib/db/videoProjectPlans.ts`
- `src/lib/db/sceneGenerationJobs.ts`
- `src/lib/db/renderJobs.ts`

Current scene outputs are versioned through `is_current`; completed scene counts drive project status to `PARTIALLY_COMPLETED` or `READY_TO_RENDER`.

## Avatar storage

`src/lib/videoMaker/avatarStorage.ts` stores uploaded avatar assets under the application data directory with generated identifiers. It validates:

- PNG, JPEG or WebP magic bytes
- extension/MIME agreement
- maximum file size
- image dimensions
- path containment
- generated storage keys rather than user filenames

No local face processing or local AI model is used.

## Planning flow

1. User creates a project with an avatar and connected LLM model.
2. `src/lib/videoMaker/internalLlm.ts` invokes the existing local OmniRoute LLM route using existing internal key selection.
3. `projectPlanning.ts` generates and validates a Master Prompt.
4. It generates exactly 33 scenes and automatically repairs invalid JSON.
5. Every scene is compiled into a complete prompt containing identity, voice, movement, continuity, timing, camera, resolution and negative constraints.
6. Master Prompt and scene prompt versions are stored in SQLite.

Relevant routes:

- `POST /api/video-projects`
- `POST /api/video-projects/{id}/plan`
- `GET/PATCH /api/video-projects/{id}/scenes`
- Avatar profile routes under `/api/avatar-profiles`

## Generation jobs

`scene_generation_jobs`, `src/lib/videoMaker/sceneJobOrchestrator.ts`, `sceneVideoProviders.ts`, `sceneJobStore.ts` and `videoMakerJobPump.ts` implement the persistence contract for:

- queue/submission/processing/completion states
- immediate provider task-ID persistence
- maximum three attempts
- exponential backoff
- no automatic retry for authentication, validation, unsupported capability or exhausted quota
- later compatible fallback only, with provider/model/idempotency switching
- a management-authenticated one-step pump that respects registered adapter concurrency
- cancellation and restart-resumable queries

Electron now invokes the one-step scene/render pump after local-server readiness and at a bounded interval while online. It uses a random localhost-only internal secret, stops with application shutdown and resumes persisted work after restart. No provider-specific asynchronous video adapter is falsely registered: existing generic handlers often poll upstream inside one request and do not expose the task ID early enough, so real adapters must still be implemented provider by provider.

## Final rendering

Added files:

- `src/lib/videoMaker/finalRenderProviders.ts`
- `src/lib/videoMaker/finalRenderOrchestrator.ts`
- `src/lib/db/renderJobs.ts`
- `src/app/api/video-projects/[id]/render/route.ts`

The abstraction requires:

- 33 current completed scene outputs
- scene order 1 through 33
- exactly 10 seconds per scene
- exactly 330 seconds total
- 16:9, 1920×1080, MP4
- provider task-ID persistence and polling
- exact duration validation when the provider reports duration

No provider adapter is falsely registered. Until a verified cloud-render provider contract is implemented and connected, the route returns `Render provider not configured.`

## User interface

Normal navigation is reduced to:

- Dashboard
- New Video
- My Projects
- Avatar Profiles
- Providers
- Usage
- Settings

Developer-oriented pages remain in source when shared functionality may depend on them, but they are removed from normal sidebar navigation.

Implemented video-maker UI paths include:

- `/home`
- `/video-maker/new`
- `/video-maker/projects`
- `/video-maker/projects/{id}`
- `/video-maker/avatars`
- `/video-maker/providers`
- `/video-maker/usage`

The project detail page shows the versioned Master Prompt, exact timeline metadata and a 33-card scene grid with prompt/dialogue editing, version restore, copy, lock, real persistent job state, preview/download links when outputs exist, individual cancellation/retry/regeneration, Generate All, render submission and render cancellation. Project list actions include search, filter, rename, duplicate, delete and resume/open.

## Electron and Windows architecture

Changed files:

- `electron/main.js`
- `electron/preload.js`
- `electron/package.json`
- Electron icon assets

Behavior:

- product name: **Bijoy AI Video Maker**
- app ID: `com.bijoy.aivideomaker`
- installer: `Bijoy-AI-Video-Maker-Setup.exe`
- portable target: `Bijoy-AI-Video-Maker-Portable.exe`
- local server host: `127.0.0.1`
- no visible terminal (`windowsHide` and packaged Electron child-process mode)
- main window waits for health readiness
- graphical startup failure page with Retry, Open Logs and affected-settings reset
- background/tray behavior is opt-in and OFF by default
- closing the window initiates full shutdown by default
- upstream auto-update is disabled by default until an owned, signed release channel exists
- Electron owns a bounded localhost scene/render job pump that pauses offline and is aborted on shutdown
- the pump route is protected by an internal random secret in addition to normal management authentication

## Security considerations

Implemented or inherited:

- AES-256-GCM credential encryption with a generated local encryption key
- renderer `contextIsolation: true`
- renderer `nodeIntegration: false`
- constrained preload API
- localhost-only server binding
- safe external URL protocol handling
- restrictive production CSP
- path containment and upload validation
- output URL HTTPS/private-IP checks
- sanitized provider responses
- no arbitrary shell execution in added video-maker code

Remaining security work:

- DNS resolution and redirect revalidation before downloading remote provider outputs, to close DNS-rebinding/redirect-to-private-address cases
- Windows code signing and installer reputation testing
- provider-by-provider log review and contract tests
- a clean-machine penetration/smoke pass after dependencies can be installed

## Features still required for production acceptance

- verified video provider adapters that satisfy reference identity, Bangla audio/lip-sync, exact 10 seconds, 16:9 and 1080p
- provider-specific video adapters that expose real upstream task IDs and media results
- scene reordering before paid generation
- project-owned generated-media cleanup
- secure remote output downloader with DNS/redirect checks
- at least one verified API cloud-render adapter
- provider usage/cost reconciliation
- clean-machine Windows installer, uninstall and orphan-process tests
- signed update channel or intentionally disabled updates for release
