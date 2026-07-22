const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  onState: (callback) => {
    ipcRenderer.on('pet-state', (_event, data) => callback(data));
  },
  setInteractive: (on) => ipcRenderer.send('pet-interactive', on),
  dragStart: (x, y) => ipcRenderer.send('pet-drag-start', { x, y }),
  dragEnd: () => ipcRenderer.send('pet-drag-end'),
  setPat: (on) => ipcRenderer.send('pet-pat', on),
});
