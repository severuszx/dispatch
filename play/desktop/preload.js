const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dispatchUpdate', {
  check: () => ipcRenderer.invoke('update:check')
});
