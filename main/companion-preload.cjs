const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('inboxCompanion', {
  state: () => ipcRenderer.invoke('inbox:companion-state'),
  expand: value => ipcRenderer.invoke('inbox:companion-expand', value),
  open: id => ipcRenderer.invoke('inbox:companion-open', id),
  position: () => ipcRenderer.invoke('inbox:companion-position'),
  sound: value => ipcRenderer.invoke('inbox:companion-sound', value),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('inbox:companion-state', listener);
    return () => ipcRenderer.removeListener('inbox:companion-state', listener);
  },
});
