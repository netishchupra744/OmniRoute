# Bijoy AI Video Maker Progress

Baseline: OmniRoute v3.8.49 source ZIP.

## Completed

- Audited the real Electron lifecycle, embedded local server, SQLite database, migration runner, provider registry, media routes and Windows packaging.
- Corrected the Bijoy migration number to `134` after finding upstream migrations through `133`.
- Rebranded Electron metadata, executable, NSIS installer, portable artifact, shortcuts and application metadata.
- Forced the embedded service to `127.0.0.1`; normal close now exits fully and tray/background mode is OFF by default.
- Added a graphical startup failure screen with Retry, Open Logs and affected-settings reset actions.
- Added the 11-table video-project schema and persistent avatar, project, scene, generation-job, output, render-job and usage records.
- Added safe application-managed avatar image storage with magic-byte, MIME/extension, dimension, size and path-containment validation.
- Added video project create/list/open/rename/duplicate/delete flows and dashboard statistics.
- Added Master Prompt generation, validation, bounded repair, editing, version history and restoration.
- Added exact 33-scene planning, validation, bounded repair and persistence.
- Added complete self-contained scene prompt compilation, editing, locking, version history and restoration.
- Added conservative provider capability metadata and filtering; forbidden local providers remain hidden from the normal user UI.
- Added persistent scene jobs with idempotency, provider task-ID storage, retries, capability-validated fallback switching, cancellation, explicit retry/regeneration and restart-resumable queries.
- Added Electron-owned restart-safe scene/render job pumping. The pump pauses offline, resumes while the app is running, and is authenticated with an internal random localhost secret.
- Added exact 33 × 10 = 330-second final-render timeline validation, cloud-render provider contracts, persistent render jobs and render cancellation.
- Added Dashboard, New Video, My Projects, Avatar Profiles, Providers, Usage and a functional 33-card project editor/status grid.
- Added offline-safe UI behavior and the required offline message.
- Hid unrelated developer navigation without deleting shared OmniRoute provider internals.
- Added mocked domain/orchestration tests and a SQLite restart-persistence integration test.
- Added a dedicated Windows GitHub Actions release workflow using Node.js 24 and the public npm registry.
- Added deterministic root/Electron dependency installation with bounded retries, focused Bijoy tests, migration verification, production build and existing Electron/NSIS packaging.
- Added release artifact verification for exact filenames, PE headers, minimum sizes and SHA-256 hashes.
- Added a local double-click Windows developer build entry point and a complete Windows build guide.

## In progress

- Provider-specific asynchronous scene generation adapters that expose real upstream task IDs immediately.
- One verified API-based cloud final-render adapter.
- Provider connection simplification and contract-tested capability/cost display.
- Project-owned generated media cleanup with path-safe deletion.
- Scene reordering before generation.
- Execution of the prepared Windows workflow on a GitHub-hosted Windows runner.

## Blocked

### Installer execution in this sandbox

The current sandbox is Linux-only, has Node `22.16.0`, has no Windows Electron runtime, and its restricted npm mirror returns `404` even for essential packages including React, Next.js and Zod. Large official Windows release binaries are also blocked from direct retrieval. Therefore this sandbox cannot execute the final Windows/NSIS build.

A dedicated `.github/workflows/bijoy-windows-installer.yml` workflow is now included. It runs on GitHub's `windows-latest` runner with Node.js 24 and the public npm registry, then uploads the verified Setup and Portable executables. The workflow still needs to be executed in a GitHub repository with Actions enabled before an actual `.exe` can be reported.

### Real provider proof

No provider credentials are embedded or requested in chat. A live three-scene proof requires a connected provider whose API contract demonstrably supports the selected reference identity, exact duration, aspect ratio, resolution, Bangla voice and lip-sync requirements. Existing generic handlers often poll inside one request, so an adapter must be written against the chosen provider's real asynchronous contract.

### Final cloud rendering

The audited source contains no true timeline compositor. The abstraction and persistent orchestration are implemented, but no cloud renderer is registered until its real authentication, upload, task polling, duration reporting and billing behavior are verified.

## Next implementation step

Run the included **Build Bijoy AI Video Maker Windows Installer** GitHub Actions workflow and download its verified Windows artifact. After the packaged app is available, perform the clean-machine startup/shutdown smoke test, then continue with one real asynchronous video-provider adapter and the three-scene proof.

## Tests performed

- 31 video-maker unit tests: passed.
- 1 SQLite restart-persistence integration test: passed.
- Exact 33-scene validation and bounded repair: passed.
- Exact 330-second calculation and final timeline validation: passed.
- Master Prompt repair and version behavior: passed.
- Prompt compiler and provider capability filter: passed.
- Status transitions, retry/fallback and task-ID persistence: passed.
- Render task persistence and incorrect-duration rejection: passed.
- Migration 134 numbering, creation, constraints, cascade deletion and foreign-key checks: passed.
- Electron `main.js` and `preload.js` syntax checks: passed.
- Pure video-maker domain/orchestration TypeScript check: passed for dependency-independent modules.
- Changed TypeScript/TSX transpile syntax and relative-import resolution checks: passed.
- `git diff --check`: passed.

## Known limitations

- All critical presenter combinations remain unverified until one model proves every required capability together.
- No real video provider adapter or final-render adapter is registered; paid generation is therefore intentionally blocked rather than simulated.
- Scene reordering and generated-media file cleanup are not complete.
- Windows DPAPI/Electron `safeStorage` wrapping of the database encryption key remains a production hardening item.
- The installer workflow is complete, but no production `.exe` has been produced until that Windows workflow is executed.
