# Build the Bijoy AI Video Maker Windows Installer

The repository includes a dedicated Windows build workflow:

`.github/workflows/bijoy-windows-installer.yml`

It builds the existing Electron application on a clean `windows-latest` runner with supported Node.js 24 and the public npm registry. It does not add a second desktop framework or a separate backend.

## GitHub Actions build

1. Put this source tree in a GitHub repository.
2. Open **Actions**.
3. Select **Build Bijoy AI Video Maker Windows Installer**.
4. Select **Run workflow**.
5. After the job succeeds, download the artifact named **Bijoy-AI-Video-Maker-Windows**.

The artifact contains:

- `Bijoy-AI-Video-Maker-Setup.exe`
- `Bijoy-AI-Video-Maker-Portable.exe`
- `SHA256SUMS.txt`
- `BUILD_MANIFEST.json`
- `latest.yml` when emitted by electron-builder

The workflow runs the focused Bijoy test suite, validates migration numbering, builds the production Next.js standalone bundle, packages the existing Electron app, checks the PE headers and minimum artifact sizes, and calculates SHA-256 hashes.

## Local Windows build

Developers with supported Node.js may double-click `BUILD_WINDOWS_INSTALLER.cmd`. Final application users do not need Node.js or any development dependency; these are build-time requirements only.

## Signing

The default workflow produces unsigned Windows binaries. Authenticode signing requires an owned certificate and protected repository secrets. Never commit a certificate or password into the repository.
