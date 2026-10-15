# Guidelines for `src/`

Supplements the [root guide](../AGENTS.md). For binary logic, also read
[rom/AGENTS.md](rom/AGENTS.md).

## Organization

- `components/`: editors, panels, and visual components. Use functional
  components and existing contexts.
- `context/RomContext.jsx`: integrates ROM state, handlers, projects, and backup.
- `hooks/useRomState.js`: loading, session state, and restoration.
- `hooks/useRomHandlers.js`: coordinates edits and UI updates.
- `hooks/useHistory.js` and `hooks/snapshotRestore.js`: history and restoration.
- `services/electronBridge.js`: the renderer's boundary with Electron.
- `services/ai*`: generation, streaming, and validation of AI-generated data.
- `utils/`: import, export, files, and shared validation.
- `i18n/`, `theme/`, and `styles/`: translations, themes, and CSS.

## State and editing

- Reuse `RomContext` and domain hooks. Keep offsets, codecs, and binary writes
  in `rom/` instead of reproducing them in components.
- When editing a ROM, preserve the sequence of snapshot creation, writing, state
  synchronization, and marking the session as modified. The UI and bytes must
  agree after editing, undoing, redoing, and restoring the original.
- Account for data shared between teams, derived attributes, and all state
  affected by copying, swapping, and importing teams.
- Preserve confirmation flows for drafts and unsaved changes, autosave per
  project, and save points. An edit made during an asynchronous save must not
  be marked as already saved.
- Handle asynchronous failures and cancellations without losing the session
  or displaying success notifications before completion.

## UI and integrations

- Use `useI18n()` and `t(...)` for new UI text. Update matching keys in
  `i18n/pt-BR.js` and `i18n/en.js`, keeping parameters compatible. Internal game
  texts in `game-translations/` serve a different purpose.
- Reuse existing confirmation, toast, input, and icon components. Maintain
  accessible controls, keyboard focus, and support for light and dark themes.
- Follow the CSS organization in `styles/` and check both themes when making
  visual changes.
- Components and hooks should call `services/electronBridge.js` instead of
  accessing `window.electronAPI` directly. Preserve web mode and existing checks
  for the availability of desktop-only features.
- Treat AI responses and imported files as data to validate before applying
  changes to the ROM. Keep credentials out of logs and public state.

## Validation

Tests live in `hooks/__tests__/`, `services/__tests__/`, `utils/__tests__/`,
and `rom/__tests__/`. Use existing tests for the affected flow; mock IPC and
network access when needed. Changes to history, saving, or projects should cover
restoration and failure as well as success.

For visual changes, run the UI and check the affected flow when the environment
allows it. A web build does not verify Electron-only operations.
