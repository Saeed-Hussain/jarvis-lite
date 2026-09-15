const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  // Memory
  getMemory: () => ipcRenderer.invoke('memory:get'),
  setMemory: (data) => ipcRenderer.invoke('memory:set', data),

  // Actions
  openApp: (appKey, options) => ipcRenderer.invoke('action:open-app', appKey, options),
  openUrl: (url) => ipcRenderer.invoke('action:open-url', url),
  openUrlInProfile: (url, browser, profile) =>
    ipcRenderer.invoke('action:open-url-profile', { url, browser, profile }),
  openCustom: (target) => ipcRenderer.invoke('action:open-custom', target),
  systemAction: (action) => ipcRenderer.invoke('action:system', action),
  sendWhatsApp: (payload) => ipcRenderer.invoke('action:whatsapp', payload),
  createFile: (filePath, content) => ipcRenderer.invoke('action:create-file', { filePath, content }),
  openFile: (filePath) => ipcRenderer.invoke('action:open-file', filePath),
  listProfiles: (browser) => ipcRenderer.invoke('action:list-profiles', browser),

  // System info
  getStats: () => ipcRenderer.invoke('system:stats'),
  getDateTime: () => ipcRenderer.invoke('system:datetime'),

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Lets the renderer tell a real desktop session from a plain browser tab
  isElectron: true,
});
