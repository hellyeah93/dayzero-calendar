const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dayzeroDesktop', {
  notify: (payload) => ipcRenderer.invoke('dayzero:notify', payload)
});
