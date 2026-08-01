# Bijoy AI Video Maker Windows Build

This branch starts from the exact OmniRoute v3.8.49 commit `930018fd10c2b727dae623310d57cb5a2aec229f`.

The Windows workflow reconstructs the checksum-verified Bijoy source overlay, runs the Bijoy validation suite, builds the production application, packages the existing Electron application with NSIS and portable targets, verifies the resulting PE files, and uploads the installer artifacts.
