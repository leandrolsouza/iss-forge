const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ROM operations
  openRom: () => ipcRenderer.invoke('dialog:openRom'),
  setCurrentRomPath: (filePath) => ipcRenderer.send('rom:setCurrentPath', filePath),
  // Absolute path of a File from a drag-and-drop (File.path was removed in Electron 32)
  getPathForFile: (file) => {
    try {
      return webUtils?.getPathForFile(file) || null;
    } catch {
      return null;
    }
  },
  saveRom: (data, filePath) => ipcRenderer.invoke('rom:save', { data, filePath }),
  saveRomAs: (options = {}) => ipcRenderer.invoke('dialog:saveRomAs', options),
  getCurrentPath: () => ipcRenderer.invoke('rom:getCurrentPath'),
  savePatch: (data, defaultName, format) =>
    ipcRenderer.invoke('patch:save', { data, defaultName, format }),
  onMenuExportPatch: (callback) => {
    ipcRenderer.on('menu:exportPatch', () => callback());
  },
  testInEmulator: (data, extension) => ipcRenderer.invoke('emulator:test', { data, extension }),
  selectEmulator: () => ipcRenderer.invoke('emulator:select'),
  onMenuTestEmulator: (callback) => {
    ipcRenderer.on('menu:testEmulator', () => callback());
  },

  // Listen for events from main process
  onRomLoaded: (callback) => {
    ipcRenderer.on('rom:loaded', (event, data) => callback(data));
  },
  // opts.fromClose: the save was chosen in the "unsaved changes" prompt on quit
  onMenuSave: (callback) => {
    ipcRenderer.on('menu:save', (event, opts) => callback(opts || {}));
  },
  onSaveAsPath: (callback) => {
    ipcRenderer.on('rom:save-as-path', (event, path, options) => callback(path, options || {}));
  },
  onRomLoadCancelled: (callback) => {
    ipcRenderer.on('rom:loadCancelled', () => callback());
  },

  // Edit menu actions
  onMenuUndo: (callback) => {
    ipcRenderer.on('menu:undo', () => callback());
  },
  onMenuRedo: (callback) => {
    ipcRenderer.on('menu:redo', () => callback());
  },
  onMenuAbout: (callback) => {
    ipcRenderer.on('menu:about', () => callback());
  },

  // App state
  setModifiedState: (isModified) => ipcRenderer.send('rom:modifiedState', isModified),
  notifySaveComplete: (fromClose = false) => ipcRenderer.send('rom:saveComplete', { fromClose }),
  setLocale: (locale) => ipcRenderer.send('app:setLocale', locale),
  setTheme: (theme) => ipcRenderer.send('app:setTheme', theme),
  sendCloseResponse: (choice) => ipcRenderer.send('app:closeResponse', choice),
  onConfirmClose: (callback) => {
    ipcRenderer.on('app:confirmClose', () => callback());
  },

  // Recent ROMs
  getRecentRoms: () => ipcRenderer.invoke('recent:getAll'),
  clearRecentRoms: () => ipcRenderer.invoke('recent:clear'),
  removeRecentRom: (filePath) => ipcRenderer.invoke('recent:remove', filePath),
  openRecentRom: (filePath) => ipcRenderer.invoke('recent:open', filePath),

  // Auto-updater
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterDownload: () => ipcRenderer.invoke('updater:download'),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback) => {
    ipcRenderer.on('updater:status', (event, data) => callback(data));
  },

  // Auto-save / Backup
  backupSave: (data, meta, original) => ipcRenderer.invoke('backup:save', { data, meta, original }),
  backupLoad: () => ipcRenderer.invoke('backup:load'),
  backupClear: () => ipcRenderer.invoke('backup:clear'),

  // Projects (ROM bytes as Uint8Array)
  projectsList: () => ipcRenderer.invoke('projects:list'),
  projectCreate: (params) => ipcRenderer.invoke('projects:create', params),
  projectLoad: (id) => ipcRenderer.invoke('projects:load', id),
  projectSave: (id, data) => ipcRenderer.invoke('projects:save', { id, data }),
  projectMarkOpened: (id) => ipcRenderer.invoke('projects:markOpened', id),
  projectUpdate: (id, changes) => ipcRenderer.invoke('projects:update', { id, changes }),
  projectDuplicate: (id, changes) => ipcRenderer.invoke('projects:duplicate', { id, changes }),
  projectDelete: (id) => ipcRenderer.invoke('projects:delete', id),
  projectAutosaveSave: (id, data) => ipcRenderer.invoke('projects:autosaveSave', { id, data }),
  projectAutosaveClear: (id) => ipcRenderer.invoke('projects:autosaveClear', id),
  projectFindOriginal: (crc) => ipcRenderer.invoke('projects:findOriginal', crc),
  projectSaveArchive: (data, defaultName) =>
    ipcRenderer.invoke('projects:saveArchive', { data, defaultName }),
  onMenuNewProject: (callback) => {
    ipcRenderer.on('menu:newProject', () => callback());
  },
  onMenuOpenProject: (callback) => {
    ipcRenderer.on('menu:openProject', () => callback());
  },
  onMenuCloseSession: (callback) => {
    ipcRenderer.on('menu:closeSession', () => callback());
  },
  // { kind: 'project' | 'rom' | null, name, ext }
  setSession: (info) => ipcRenderer.send('app:setSession', info),
  showInFolder: (target) => ipcRenderer.invoke('shell:showInFolder', target),

  // AI Team Generator
  aiGetSettings: () => ipcRenderer.invoke('ai:getSettings'),
  aiSaveSettings: (settings) => ipcRenderer.invoke('ai:saveSettings', settings),
  aiGenerate: (payload) => ipcRenderer.invoke('ai:generate', payload),
  aiTestConnection: (payload) => ipcRenderer.invoke('ai:testConnection', payload),
  aiGenerateStream: (payload) => ipcRenderer.invoke('ai:generate-stream', payload),
  aiCancelStream: (requestId) => ipcRenderer.invoke('ai:cancel-stream', requestId),
  // The stream listeners return a function that removes them
  onAiStreamChunk: (callback) => {
    const handler = (event, chunk, requestId) => callback(chunk, requestId);
    ipcRenderer.on('ai:stream-chunk', handler);
    return () => ipcRenderer.removeListener('ai:stream-chunk', handler);
  },
  onAiStreamDone: (callback) => {
    const handler = (event, info) => callback(info || {});
    ipcRenderer.on('ai:stream-done', handler);
    return () => ipcRenderer.removeListener('ai:stream-done', handler);
  },
  onAiStreamError: (callback) => {
    const handler = (event, error, requestId) => callback(error, requestId);
    ipcRenderer.on('ai:stream-error', handler);
    return () => ipcRenderer.removeListener('ai:stream-error', handler);
  },

  // App Settings
  settingsGetAll: () => ipcRenderer.invoke('settings:getAll'),
  settingsGet: (key) => ipcRenderer.invoke('settings:get', key),
  settingsSet: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
  settingsSetAll: (settings) => ipcRenderer.invoke('settings:setAll', settings),
  settingsSelectExportPath: () => ipcRenderer.invoke('settings:selectExportPath'),

  // Cleanup listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
