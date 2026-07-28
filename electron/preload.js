const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  // Memory
  getMemory: () => ipcRenderer.invoke('memory:get'),
  setMemory: (data) => ipcRenderer.invoke('memory:set', data),

  // Actions
  openApp: (appKey) => ipcRenderer.invoke('action:open-app', appKey),
  openUrl: (url) => ipcRenderer.invoke('action:open-url', url),
  openCustom: (target) => ipcRenderer.invoke('action:open-custom', target),
  systemAction: (action) => ipcRenderer.invoke('action:system', action),
  createFile: (filePath, content) => ipcRenderer.invoke('action:create-file', { filePath, content }),
  openFile: (filePath) => ipcRenderer.invoke('action:open-file', filePath),

  // System info
  getStats: () => ipcRenderer.invoke('system:stats'),
  getDateTime: () => ipcRenderer.invoke('system:datetime'),

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Environment flag so renderer knows it's running inside Electron
  isElectron: true,
});
