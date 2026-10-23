const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  getClientPresets: () => ipcRenderer.invoke('oidc:get-presets'),
  discoverEndpoints: (discoveryUrl) => ipcRenderer.invoke('oidc:discover', discoveryUrl),
  startLogin: (config) => ipcRenderer.invoke('oidc:start-login', config),
  clearSession: () => ipcRenderer.invoke('oidc:clear-session'),
  getImporters: () => ipcRenderer.invoke('oidc:get-importers'),
  parseImport: (importerId, rawText) => ipcRenderer.invoke('oidc:parse-import', { importerId, rawText }),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
});
