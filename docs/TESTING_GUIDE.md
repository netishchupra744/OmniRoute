# Bijoy AI Video Maker Testing Guide

## Dependency-independent unit tests

```bash
node --experimental-strip-types --test tests/unit/videoMaker/*.test.ts
```

Current result in this workspace: **31 passed, 0 failed**.

Covered behavior:

- 33 × 10 = 330 seconds
- strict Master Prompt repair
- strict 33-scene JSON validation and repair
- duplicate dialogue/purpose rejection
- self-contained prompt compilation
- scene/project transitions
- retry/fallback decisions
- conservative provider filtering
- final-render timeline validation
- mocked scene provider task persistence
- adapter registry safety and exact scene-duration rejection
- mocked render provider task persistence
- incorrect final duration rejection

## SQLite restart-persistence integration test

```bash
node --experimental-strip-types --test tests/integration/videoMakerPersistence.test.ts
```

Current result: **1 passed, 0 failed**.

This test applies migration 134, stores an avatar/project/master prompt/33 scenes/33 generation task IDs/33 outputs/render task, closes and reopens SQLite, verifies all state survives, verifies the 330-second timeline, verifies cascade deletion and runs `PRAGMA foreign_key_check`.

## Pure TypeScript validation

Dependency-independent domain/orchestration modules can be checked with the globally available compiler:

```bash
tsc --noEmit --pretty false --incremental false \
  --target ES2022 --module NodeNext --moduleResolution NodeNext \
  --allowImportingTsExtensions --skipLibCheck \
  src/domain/videoMaker/*.ts \
  src/lib/videoMaker/finalRenderProviders.ts \
  src/lib/videoMaker/finalRenderOrchestrator.ts \
  src/lib/videoMaker/sceneJobOrchestrator.ts
```

Current result: passed. Full application type checking still requires repository dependencies.

## Electron and migration validation

```bash
node --check electron/main.js
node --check electron/preload.js
node scripts/check/check-migration-numbering.mjs
git diff --check
```

Current results: passed. Migration checker reports no duplicate migration numbers.

## Full repository validation

Run in a supported environment with complete package access and Node `22.22.2+` in the supported Node 22 range, or supported Node 24/26:

```bash
npm ci
npm run test:unit
npm run lint
npm run build
npm run electron:build:win
npm run electron:smoke:packaged
```

Do not disable upstream tests. Record pre-existing failures separately from Bijoy regressions.

## Mock integration acceptance

Automated tests must continue to use mocked providers for paid operations and cover:

1. create avatar and project;
2. generate/repair Master Prompt;
3. generate/repair exact 33-scene plan;
4. persist all compiled prompts;
5. queue scene jobs;
6. persist task IDs before polling;
7. restart/reload resumable jobs;
8. retry transient errors and stop on permanent authentication/validation errors;
9. assemble 33 completed outputs into a 330-second render timeline;
10. persist final render task and output.

## Real provider three-scene proof

Run only with explicitly connected test accounts. Record provider, model/version, request IDs, actual cost and returned media metadata.

The proof passes only when all three scenes demonstrate:

- same uploaded reference avatar identity;
- same selected visual style;
- provider-reported 10-second duration;
- real asynchronous task status and polling;
- preview and individual retry/regeneration;
- persistence after application restart;
- no duplicate paid submission during resume.

## Windows release smoke test

Use a clean Windows machine without Node, Python, FFmpeg, Docker, WSL or OmniRoute installed. Test install, first launch, no console, single instance, provider login, offline behavior, restart recovery, render cancellation, complete shutdown, uninstall and orphan-process absence.
