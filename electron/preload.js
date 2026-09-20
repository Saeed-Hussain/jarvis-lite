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
  openPath: (query, base) => ipcRenderer.invoke('action:open-path', { query, base }),
  listPath: (query, base) => ipcRenderer.invoke('action:list-path', { query, base }),
  resolvePath: (query, base) => ipcRenderer.invoke('action:resolve-path', { query, base }),
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
  showWindow: () => ipcRenderer.invoke('window:show'),
  hideWindow: () => ipcRenderer.invoke('window:hide'),

  // Lets the renderer tell a real desktop session from a plain browser tab
  isElectron: true,

  // Pilot: reading the screen and driving it. Kept as its own namespace so the
  // privileged surface is obvious at a glance in a review.
  pilot: {
    available: () => ipcRenderer.invoke('pilot:available'),
    foreground: () => ipcRenderer.invoke('pilot:foreground'),
    tree: (options) => ipcRenderer.invoke('pilot:tree', options),
    windows: () => ipcRenderer.invoke('pilot:windows'),
    elementAt: (x, y) => ipcRenderer.invoke('pilot:element-at', { x, y }),
    pollInput: () => ipcRenderer.invoke('pilot:poll-input'),
    act: (action, options) => ipcRenderer.invoke('pilot:act', action, options),
    capture: (options) => ipcRenderer.invoke('pilot:capture', options),
    settle: (options) => ipcRenderer.invoke('pilot:settle', options),
    review: (steps) => ipcRenderer.invoke('pilot:review', steps),

    stop: () => ipcRenderer.invoke('pilot:stop'),
    clearStop: () => ipcRenderer.invoke('pilot:clear-stop'),
    stopState: () => ipcRenderer.invoke('pilot:stop-state'),

    workflows: () => ipcRenderer.invoke('pilot:workflows'),
    saveWorkflow: (workflow) => ipcRenderer.invoke('pilot:save-workflow', workflow),
    deleteWorkflow: (id) => ipcRenderer.invoke('pilot:delete-workflow', id),
    findWorkflow: (nameOrId) => ipcRenderer.invoke('pilot:find-workflow', nameOrId),
    recordRun: (id, summary) => ipcRenderer.invoke('pilot:record-run', id, summary),

    journal: (limit) => ipcRenderer.invoke('pilot:journal', limit),
    undo: (entryId) => ipcRenderer.invoke('pilot:undo', entryId),
    undoRun: (runId) => ipcRenderer.invoke('pilot:undo-run', runId),

    // The stop shortcut fires whatever has focus, so the renderer has to be
    // told rather than asked. Returns an unsubscribe.
    onStopped: (handler) => {
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on('pilot:stopped', listener);
      return () => ipcRenderer.removeListener('pilot:stopped', listener);
    },
  },
});
