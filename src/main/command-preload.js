const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('commandApi', {
  getPlatforms: () => ipcRenderer.invoke('command:getPlatforms'),
  getAccounts: () => ipcRenderer.invoke('command:getAccounts'),
  executeCommand: (accountId, platform, actionId, params) =>
    ipcRenderer.invoke('command:execute', { accountId, platform, actionId, params }),
  stopCommand: () => ipcRenderer.invoke('command:stop'),
  onCommandLog: (callback) => {
    ipcRenderer.on('command:log', (event, data) => callback(data));
  },
  onCommandDone: (callback) => {
    ipcRenderer.on('command:done', (event, data) => callback(data));
  },
  removeListeners: () => {
    ipcRenderer.removeAllListeners('command:log');
    ipcRenderer.removeAllListeners('command:done');
  },
});
