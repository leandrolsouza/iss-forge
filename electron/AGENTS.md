# Guidelines for `electron/`

Supplements the [root guide](../AGENTS.md).

## Process boundary

- `.mjs` files use ES modules; `preload.js` uses CommonJS. Preserve this
  distinction and keep the preload compatible with the sandbox.
- Preserve `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  and the content security policy defined in `contentSecurity.mjs`.
- Expose specific operations through `contextBridge`; do not expose a generic
  `ipcRenderer`, arbitrary execution, or unrestricted file access to the renderer.
- Register handlers through the wrapper in `ipcSecurity.mjs`, preserving sender
  checks and argument validation. For a new channel, update its validation,
  the preload, and `src/services/electronBridge.js` together.
- Preserve listener cleanup in new or modified subscription APIs, preventing
  duplicate events after components remount.

## Files, credentials, and networking

- Reuse `atomicFile.mjs`, `backups.mjs`, and `projects.mjs`. Preserve atomic
  writes, session recovery, and separation of files for each project.
- Validate identifiers, paths, and data sizes in the main process. Do not rely
  solely on UI checks for privileged operations.
- Use `credentials.mjs` and secure OS storage. Stored keys must not return to
  the renderer or appear in logs, errors, or project files. Preserve the
  memory-only mode when secure storage fails.
- Keep credentials scoped to their provider and destination. Preserve the HTTPS
  endpoint rule, with HTTP allowed for local servers according to validation.
- When launching emulators, preserve separate arguments and use a temporary ROM;
  do not overwrite the original to test the game.

## Updates and validation

- Updater state belongs to the main process. Preserve serialized checks/downloads
  and allow installation only after the download completes.
- Restarting to install must respect the save, discard, or cancel flow when
  there are unsaved changes. Preserve OS-specific flows.
- Tests for these modules are mainly in `src/services/__tests__/` (IPC,
  credentials, persistence, projects, and updater). Update and run affected tests,
  including rejection of invalid arguments and senders.
- Changes to the preload, menus, dialogs, or lifecycle also need verification
  in Electron when available. `npm run build` validates the renderer but does
  not replace that verification.
