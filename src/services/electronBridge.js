/**
 * Electron Bridge Service
 *
 * Centralizes all communication with the Electron main process.
 * Components and hooks should import from here instead of accessing
 * window.electronAPI directly — makes testing easier and keeps
 * the Electron/web boundary explicit.
 */

/**
 * Check if running inside Electron
 */
export function isElectron() {
  return !!window.electronAPI;
}

// ─── ROM Operations ──────────────────────────────────────────────────────────

/**
 * Open file dialog and load a ROM via Electron IPC
 */
export function openRom() {
  return window.electronAPI.openRom();
}

/**
 * Save ROM data to disk
 * @param {number[]} data - ROM byte array
 * @param {string} [filePath] - Optional specific path
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export function saveRom(data, filePath) {
  return window.electronAPI.saveRom(data, filePath);
}

/**
 * Open "Save As" dialog
 */
export function saveRomAs(options) {
  return window.electronAPI.saveRomAs(options);
}

/**
 * Get current ROM file path
 */
export function getCurrentPath() {
  return window.electronAPI.getCurrentPath();
}

/**
 * Tell the main process which file the editor is now working on
 * (target of "Save", added to recents). Called only after a ROM is accepted.
 * @param {string|null} filePath
 */
export function setCurrentRomPath(filePath) {
  window.electronAPI.setCurrentRomPath?.(filePath);
}

/**
 * Absolute path of a dropped File (null when unavailable)
 * @param {File} file
 * @returns {string|null}
 */
export function getPathForFile(file) {
  return window.electronAPI.getPathForFile?.(file) || null;
}

/**
 * Show a "Save patch" dialog and write the patch file
 * @param {number[]} data - patch bytes
 * @param {string} defaultName - suggested file name (e.g. "ISS.bps")
 * @param {'bps'|'ips'} format
 * @returns {Promise<{success: boolean, canceled?: boolean, path?: string, error?: string}>}
 */
export function savePatch(data, defaultName, format) {
  return window.electronAPI.savePatch(data, defaultName, format);
}

/**
 * Listen for "Export patch" menu events
 * @param {function} callback
 */
export function onMenuExportPatch(callback) {
  window.electronAPI.onMenuExportPatch?.(callback);
}

/**
 * Write the ROM to a temp file and open it in the configured emulator
 * @param {number[]} data - ROM bytes
 * @param {string} extension - '.sfc' or '.smc'
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export function testInEmulator(data, extension) {
  return window.electronAPI.testInEmulator(data, extension);
}

/** Native file picker for the emulator executable (saved in settings) */
export function selectEmulator() {
  return window.electronAPI.selectEmulator();
}

// ─── Event Listeners ─────────────────────────────────────────────────────────

/**
 * Listen for ROM loaded events from main process
 * @param {function} callback
 */
export function onRomLoaded(callback) {
  window.electronAPI.onRomLoaded(callback);
}

/**
 * Listen for menu save events
 * @param {function} callback
 */
export function onMenuSave(callback) {
  window.electronAPI.onMenuSave(callback);
}

/**
 * Listen for menu undo events
 * @param {function} callback
 */
export function onMenuUndo(callback) {
  window.electronAPI.onMenuUndo(callback);
}

/**
 * Listen for menu redo events
 * @param {function} callback
 */
export function onMenuRedo(callback) {
  window.electronAPI.onMenuRedo(callback);
}

/**
 * Notify main process of modified state (for close guard)
 * @param {boolean} isModified
 */
export function setModifiedState(isModified) {
  window.electronAPI.setModifiedState(isModified);
}

/**
 * Notify main process that save operation completed
 */
export function notifySaveComplete(fromClose = false) {
  window.electronAPI.notifySaveComplete(fromClose);
}

/**
 * Listen for "save as" path events
 * @param {function} callback
 */
export function onSaveAsPath(callback) {
  window.electronAPI.onSaveAsPath(callback);
}

/**
 * Remove all listeners for a specific channel
 * @param {string} channel
 */
export function removeAllListeners(channel) {
  window.electronAPI.removeAllListeners(channel);
}

// ─── Recent ROMs ─────────────────────────────────────────────────────────────

/**
 * Get list of recently opened ROMs
 * @returns {Promise<string[]>}
 */
export function getRecentRoms() {
  return window.electronAPI.getRecentRoms();
}

/**
 * Clear recent ROMs list
 */
export function clearRecentRoms() {
  return window.electronAPI.clearRecentRoms();
}

/**
 * Remove a specific ROM from recents
 * @param {string} filePath
 */
export function removeRecentRom(filePath) {
  return window.electronAPI.removeRecentRom(filePath);
}

/**
 * Open a ROM from the recent list
 * @param {string} filePath
 */
export function openRecentRom(filePath) {
  return window.electronAPI.openRecentRom(filePath);
}

// ─── Auto-Save / Backup ──────────────────────────────────────────────────────

/**
 * Save ROM data as a backup
 * @param {number[]} data - ROM byte array
 * @param {object} meta - Metadata (fileName, timestamp, modified state)
 * @param {number[]} [original] - the unedited ROM; only needed once per session
 * @returns {Promise<{success: boolean, timestamp?: number, error?: string}>}
 */
export function backupSave(data, meta, original) {
  return window.electronAPI.backupSave(data, meta, original);
}

/**
 * Load the last auto-save backup
 * @returns {Promise<{exists: boolean, data?: number[], original?: number[]|null, meta?: object, error?: string}>}
 */
export function backupLoad() {
  return window.electronAPI.backupLoad();
}

/**
 * Clear/remove the auto-save backup files
 * @returns {Promise<{success: boolean}>}
 */
export function backupClear() {
  return window.electronAPI.backupClear();
}

// ─── Projects ────────────────────────────────────────────────────────────────
// Every call resolves to { success, error?, ... }; `error` is an i18n key for the
// project errors (projectNotFound, projectNameRequired...) or an OS message.
// ROM bytes go and come back as Uint8Array.

/** @returns {Promise<{success: boolean, projects?: object[], error?: string}>} */
export function projectsList() {
  return window.electronAPI.projectsList();
}

/**
 * @param {{ name: string, description?: string, romFileName?: string, baseCrc?: string,
 *   original: Uint8Array, data?: Uint8Array }} params
 * @returns {Promise<{success: boolean, project?: object, error?: string}>}
 */
export function projectCreate(params) {
  return window.electronAPI.projectCreate(params);
}

/**
 * @param {string} id
 * @returns {Promise<{success: boolean, project?: object, data?: Uint8Array,
 *   original?: Uint8Array, autosave?: Uint8Array|null, error?: string}>}
 */
export function projectLoad(id) {
  return window.electronAPI.projectLoad(id);
}

/** Save the project's ROM. @returns {Promise<{success: boolean, project?: object, error?: string}>} */
export function projectSave(id, data) {
  return window.electronAPI.projectSave(id, data);
}

/** The project was opened in the editor (list order: most recently used first) */
export function projectMarkOpened(id) {
  return window.electronAPI.projectMarkOpened?.(id);
}

/**
 * Tell the main process what is open (native menu labels, "Save As" suggestion)
 * @param {{ kind: 'project'|'rom'|null, name?: string, ext?: string }} info
 */
export function setSession(info) {
  window.electronAPI.setSession?.(info);
}

/**
 * Open a folder, or select a file in its folder, in the system file manager
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export function showInFolder(target) {
  return window.electronAPI.showInFolder(target);
}

/** @param {{ newProject?: function, openProject?: function, closeSession?: function }} handlers */
export function onProjectMenus({ newProject, openProject, closeSession }) {
  window.electronAPI.onMenuNewProject?.(newProject);
  window.electronAPI.onMenuOpenProject?.(openProject);
  window.electronAPI.onMenuCloseSession?.(closeSession);
  return () =>
    ['menu:newProject', 'menu:openProject', 'menu:closeSession'].forEach((channel) =>
      window.electronAPI.removeAllListeners(channel),
    );
}

/** @param {{ name?: string, description?: string }} changes */
export function projectUpdate(id, changes) {
  return window.electronAPI.projectUpdate(id, changes);
}

/** @param {{ name?: string, description?: string }} changes - of the copy */
export function projectDuplicate(id, changes) {
  return window.electronAPI.projectDuplicate(id, changes);
}

export function projectDelete(id) {
  return window.electronAPI.projectDelete(id);
}

export function projectAutosaveSave(id, data) {
  return window.electronAPI.projectAutosaveSave(id, data);
}

export function projectAutosaveClear(id) {
  return window.electronAPI.projectAutosaveClear(id);
}

/**
 * Unedited ROM of an existing project with this base CRC (hex)
 * @returns {Promise<{success: boolean, original?: Uint8Array|null}>}
 */
export function projectFindOriginal(crc) {
  return window.electronAPI.projectFindOriginal(crc);
}

/**
 * "Save" dialog for an exported project file (.issproj)
 * @returns {Promise<{success: boolean, canceled?: boolean, path?: string, error?: string}>}
 */
export function projectSaveArchive(data, defaultName) {
  return window.electronAPI.projectSaveArchive(data, defaultName);
}

// ─── AI Team Generator ───────────────────────────────────────────────────────

/**
 * Get AI settings (endpoint, model, temperature, maxTokens)
 * @returns {Promise<object>}
 */
export function aiGetSettings() {
  return window.electronAPI.aiGetSettings();
}

/**
 * Save AI settings
 * @param {object} settings
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export function aiSaveSettings(settings) {
  return window.electronAPI.aiSaveSettings(settings);
}

/**
 * Call the LLM API to generate team data
 * @param {object} payload - { prompt, systemPrompt, settings? }
 * @returns {Promise<{success: boolean, content?: string, error?: {code: string, detail: string}, usage?: object}>}
 */
export function aiGenerate(payload) {
  return window.electronAPI.aiGenerate(payload);
}

/**
 * Test the AI connection with a simple request
 * @param {object} payload - { settings }
 * @returns {Promise<{success: boolean, content?: string, error?: {code: string, detail: string}}>}
 */
export function aiTestConnection(payload) {
  return window.electronAPI.aiTestConnection(payload);
}

/**
 * Start a streaming LLM generation. Chunks arrive via event listeners.
 * @param {object} payload - { prompt, systemPrompt, settings?, schema?, requestId? }
 * @returns {Promise<{success: boolean}>}
 */
export function aiGenerateStream(payload) {
  return window.electronAPI.aiGenerateStream(payload);
}

/**
 * Cancel a running stream started with aiGenerateStream
 * @param {string} requestId
 */
export function aiCancelStream(requestId) {
  return window.electronAPI.aiCancelStream(requestId);
}

/**
 * Listen for streaming text chunks from LLM
 * @param {function} callback - receives (chunk, requestId)
 * @returns {function} removes the listener
 */
export function onAiStreamChunk(callback) {
  return window.electronAPI.onAiStreamChunk(callback);
}

/**
 * Listen for stream completion
 * @param {function} callback - receives { requestId, stopReason, truncated }
 * @returns {function} removes the listener
 */
export function onAiStreamDone(callback) {
  return window.electronAPI.onAiStreamDone(callback);
}

/**
 * Listen for stream errors
 * @param {function} callback - receives ({ code, detail }, requestId) (see aiErrorKey in aiProviders.js)
 * @returns {function} removes the listener
 */
export function onAiStreamError(callback) {
  return window.electronAPI.onAiStreamError(callback);
}

// ─── App Settings ────────────────────────────────────────────────────────────

/**
 * Get all app settings
 * @returns {Promise<object>}
 */
export function settingsGetAll() {
  return window.electronAPI.settingsGetAll();
}

/**
 * Get a single setting by key
 * @param {string} key
 * @returns {Promise<*>}
 */
export function settingsGet(key) {
  return window.electronAPI.settingsGet(key);
}

/**
 * Set a single setting
 * @param {string} key
 * @param {*} value
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export function settingsSet(key, value) {
  return window.electronAPI.settingsSet(key, value);
}

/**
 * Set multiple settings at once
 * @param {object} settings
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export function settingsSetAll(settings) {
  return window.electronAPI.settingsSetAll(settings);
}

/**
 * Open native directory picker for export path
 * @returns {Promise<{success: boolean, path?: string}>}
 */
export function settingsSelectExportPath() {
  return window.electronAPI.settingsSelectExportPath();
}
