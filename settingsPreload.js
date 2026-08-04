const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  getInitial: () => ipcRenderer.invoke('settings-get-initial'),
  save: (data) => ipcRenderer.send('settings-save', data),
});
