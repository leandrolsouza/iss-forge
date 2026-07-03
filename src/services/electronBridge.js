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
