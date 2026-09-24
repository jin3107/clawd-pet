const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('modelPickerAPI', {
  pick: (model) => ipcRenderer.send('model-pick', model),
});
