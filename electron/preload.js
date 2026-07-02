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

  // Recent ROMs
  getRecentRoms: () => ipcRenderer.invoke('recent:getAll'),
  clearRecentRoms: () => ipcRenderer.invoke('recent:clear'),
  removeRecentRom: (filePath) => ipcRenderer.invoke('recent:remove', filePath),
  openRecentRom: (filePath) => ipcRenderer.invoke('recent:open', filePath),

  // Cleanup listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
