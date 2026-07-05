const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ROM operations
  openRom: () => ipcRenderer.invoke('dialog:openRom'),
  saveRom: (data, filePath) => ipcRenderer.invoke('rom:save', { data, filePath }),
  saveRomAs: () => ipcRenderer.invoke('dialog:saveRomAs'),
  getCurrentPath: () => ipcRenderer.invoke('rom:getCurrentPath'),

  // Listen for events from main process
  onRomLoaded: (callback) => {
    ipcRenderer.on('rom:loaded', (event, data) => callback(data));
  },
  onMenuSave: (callback) => {
    ipcRenderer.on('menu:save', () => callback());
  },
  onSaveAsPath: (callback) => {
    ipcRenderer.on('rom:save-as-path', (event, path) => callback(path));
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

  // App state
  setModifiedState: (isModified) => ipcRenderer.send('rom:modifiedState', isModified),
  notifySaveComplete: () => ipcRenderer.send('rom:saveComplete'),
  setLocale: (locale) => ipcRenderer.send('app:setLocale', locale),
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
  backupSave: (data, meta) => ipcRenderer.invoke('backup:save', { data, meta }),
  backupLoad: () => ipcRenderer.invoke('backup:load'),
  backupClear: () => ipcRenderer.invoke('backup:clear'),

  // AI Team Generator
  aiGetSettings: () => ipcRenderer.invoke('ai:getSettings'),
  aiSaveSettings: (settings) => ipcRenderer.invoke('ai:saveSettings', settings),
  aiGenerate: (payload) => ipcRenderer.invoke('ai:generate', payload),
  aiTestConnection: (payload) => ipcRenderer.invoke('ai:testConnection', payload),
  aiGenerateStream: (payload) => ipcRenderer.invoke('ai:generate-stream', payload),
  onAiStreamChunk: (callback) => {
    ipcRenderer.on('ai:stream-chunk', (event, chunk) => callback(chunk));
  },
  onAiStreamDone: (callback) => {
    ipcRenderer.on('ai:stream-done', () => callback());
  },
  onAiStreamError: (callback) => {
    ipcRenderer.on('ai:stream-error', (event, error) => callback(error));
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
