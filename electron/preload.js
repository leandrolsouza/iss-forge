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

  // Cleanup listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
