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
export function saveRomAs() {
  return window.electronAPI.saveRomAs();
}

/**
 * Get current ROM file path
 */
export function getCurrentPath() {
  return window.electronAPI.getCurrentPath();
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
export function notifySaveComplete() {
  window.electronAPI.notifySaveComplete();
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
 * @returns {Promise<{success: boolean, timestamp?: number, error?: string}>}
 */
export function backupSave(data, meta) {
  return window.electronAPI.backupSave(data, meta);
}

/**
 * Load the last auto-save backup
 * @returns {Promise<{exists: boolean, data?: number[], meta?: object, error?: string}>}
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
 * @returns {Promise<{success: boolean, content?: string, error?: string, usage?: object}>}
 */
export function aiGenerate(payload) {
  return window.electronAPI.aiGenerate(payload);
}

/**
 * Start a streaming LLM generation. Chunks arrive via event listeners.
 * @param {object} payload - { prompt, systemPrompt, settings? }
 * @returns {Promise<{success: boolean}>}
 */
export function aiGenerateStream(payload) {
  return window.electronAPI.aiGenerateStream(payload);
}

/**
 * Listen for streaming text chunks from LLM
 * @param {function} callback - receives a string chunk
 */
export function onAiStreamChunk(callback) {
  window.electronAPI.onAiStreamChunk(callback);
}

/**
 * Listen for stream completion
 * @param {function} callback
 */
export function onAiStreamDone(callback) {
  window.electronAPI.onAiStreamDone(callback);
}

/**
 * Listen for stream errors
 * @param {function} callback - receives error message string
 */
export function onAiStreamError(callback) {
  window.electronAPI.onAiStreamError(callback);
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
