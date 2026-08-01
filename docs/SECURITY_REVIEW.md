# Bijoy AI Video Maker Security Review

## Threat model

The desktop application holds provider credentials, avatar images, prompts, task IDs and media URLs. Primary risks are credential disclosure, renderer-to-Node escape, exposed localhost services, malicious uploads, path traversal, SSRF, unsafe external URL opening, leaked provider responses and orphan background processes.

## Implemented or inherited controls

### Credential handling

- Existing OmniRoute provider connection architecture is reused; no second credential store is introduced.
- `src/lib/db/encryption.ts` uses AES-256-GCM with authentication tags and a `scrypt`-derived key.
- Electron creates and persists a random `STORAGE_ENCRYPTION_KEY` on first run and does not silently replace a missing key when encrypted credentials exist.
- Added provider payload persistence uses sanitization before storage.
- No provider credential is hard-coded in Bijoy code.

### Electron renderer boundary and lifecycle

- `contextIsolation: true` and `nodeIntegration: false` remain enabled.
- Preload exposes a narrow API; added code does not expose arbitrary shell execution.
- New windows are denied and external opening is restricted to parsed HTTP/HTTPS URLs.
- Normal close fully terminates the app by default; background mode requires explicit opt-in.
- The Electron-owned job pump stops/aborts with server shutdown and pauses when offline.

### Local service and internal job pump

- Embedded server and child-process `HOSTNAME` are bound to `127.0.0.1`.
- Existing single-instance and process-tree shutdown controls are retained.
- Electron creates a random `BIJOY_INTERNAL_JOB_SECRET`, persists it in the restricted application environment file, passes it only to the child server and sends it in the `x-bijoy-job-secret` header.
- The pump route accepts that secret only for localhost requests, compares it in constant time, and otherwise requires existing management authentication.

### Upload and path handling

- Avatar files are limited to PNG/JPEG/WebP.
- Magic bytes, extension/MIME agreement, image dimensions and file size are checked.
- Files receive generated identifiers; user filenames are not used as storage paths.
- Resolved paths must stay inside the application-managed directory.
- File permissions are restricted when written.

### Remote provider output

- Output URLs must use HTTPS and cannot contain embedded credentials.
- Literal localhost, `.local`, loopback, link-local and private IP destinations are rejected.
- Provider responses are sanitized before persistence.

### Database

- Migration 134 uses foreign keys and constrained status values.
- Project-owned relational rows cascade on project deletion.
- Provider task IDs, error histories and retry timing survive restart.

## Open findings

### High: DNS and redirect SSRF hardening

Literal private-address checks are not sufficient against DNS rebinding or redirects. Any future downloader must resolve immediately before connection, reject every private/link-local/loopback answer, validate every redirect target, enforce response-size/content-type limits, use timeouts/abort signals and never forward credentials to a redirected host.

### High: real provider adapter isolation

Each media/render adapter needs contract tests proving credentials are sent only to intended hosts, task IDs are saved before polling, idempotency prevents duplicate billing where supported, and provider errors/logs are redacted.

### Medium: Windows secret-at-rest hardening

The database encryption key is stored in the application environment file. This protects encrypted database values from casual inspection but is not equivalent to user-bound Windows DPAPI. Before production release, wrap the key with Electron `safeStorage`/DPAPI while retaining migration/recovery compatibility.

### Medium: generated-media deletion

Database rows cascade and avatar files can be removed safely, but project-owned generated scene/final media cleanup must be completed with strict ownership/path checks.

### Medium: production CSP and provider origins

The production CSP should be reduced to the exact provider/auth origins required by the final normal-user UI after real adapters are selected.

## Release security requirements

- dependency/source vulnerability scan
- production package secret scan
- code signing
- malicious upload corpus tests
- DNS-rebinding and redirect SSRF tests
- provider error/log redaction tests
- localhost exposure test from another device
- repeated launch/quit orphan-process tests
- clean-machine install/uninstall test
