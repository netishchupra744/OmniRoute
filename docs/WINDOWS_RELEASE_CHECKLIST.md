# Windows Release Checklist

## Branding and packaging configuration

- [x] Product name changed to Bijoy AI Video Maker.
- [x] App ID changed to `com.bijoy.aivideomaker`.
- [x] Executable, shortcuts and uninstaller metadata changed.
- [x] NSIS artifact name set to `Bijoy-AI-Video-Maker-Setup.exe`.
- [x] Portable artifact name set to `Bijoy-AI-Video-Maker-Portable.exe`.
- [x] Branded placeholder icon assets installed.
- [ ] Replace placeholders with final production artwork at all Windows sizes.
- [ ] Apply Authenticode code signing.

## Startup and shutdown implementation

- [x] Single-instance lock retained.
- [x] Embedded server starts without a visible terminal.
- [x] Server host forced to `127.0.0.1`.
- [x] Health readiness checked before normal use.
- [x] Graphical startup failure page supports Retry, Open Logs and affected-settings reset.
- [x] Normal close exits instead of hiding to tray.
- [x] Background mode is OFF by default.
- [x] Existing process-tree shutdown retained.
- [x] Scene/render job pump pauses offline and is stopped/aborted during server shutdown.
- [ ] Test corrupt/missing database and occupied-port scenarios on Windows.
- [ ] Verify no orphan Electron/Node process after repeated open/close cycles.
- [ ] Verify shutdown during provider polling and rendering.

## Build environment

- [x] Add a dedicated manual GitHub Actions Windows builder using `windows-latest`.
- [x] Pin the Windows builder to supported Node.js 24.
- [x] Force the build runner to use the public npm registry.
- [x] Use deterministic root and Electron `npm ci` installs with bounded retry.
- [x] Add the focused `npm run test:bijoy` release gate.
- [x] Add migration-numbering and production Next build gates.
- [x] Add existing Electron/NSIS Windows packaging to the workflow.
- [x] Add PE-header, artifact-name, minimum-size and SHA-256 verification.
- [x] Add artifact upload for installer, portable app, checksums and build manifest.
- [ ] Execute the workflow in a GitHub repository with Actions enabled.
- [ ] Confirm the packaged Electron smoke test on the produced Windows artifact.
- [ ] Record the resulting installer and portable hashes in the release record.

## Clean-machine acceptance

- [ ] Install without Node, Python, FFmpeg, Docker, WSL or OmniRoute installed.
- [ ] Confirm no console window appears and only one instance runs.
- [ ] Confirm first-run secret bootstrap succeeds.
- [ ] Create an avatar and a 33-scene project.
- [ ] Confirm offline project viewing/editing and generation blocking.
- [ ] Restart during scene polling and verify recovery without duplicate billing.
- [ ] Complete a verified three-scene provider proof.
- [ ] Complete a 33-scene run with controlled concurrency, retry and cancellation.
- [ ] Submit an API-based final render and download MP4.
- [ ] Confirm provider-reported final duration is 330 seconds.
- [ ] Verify render cancellation and application shutdown during polling.
- [ ] Uninstall and verify application-data retention/removal choices.
- [ ] Verify Start menu, desktop shortcut and uninstaller names.

## Release safety

- [x] Upstream auto-update disabled by default.
- [ ] Configure an owned signed update channel before enabling updates.
- [ ] Review provider terms, capability claims and estimated-cost disclosures.
- [ ] Verify no credentials/tokens in packaged source maps or logs.
