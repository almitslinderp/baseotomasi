const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
 account: {
  getAll: () => ipcRenderer.invoke('account:getAll'),
  add: (data) => ipcRenderer.invoke('account:add', data),
  update: (id, data) => ipcRenderer.invoke('account:update', id, data),
  delete: (id) => ipcRenderer.invoke('account:delete', id),
 },
 browser: {
  launch: (accountIds) => ipcRenderer.invoke('browser:launch', accountIds),
  stop: (accountId) => ipcRenderer.invoke('browser:stop', accountId),
  stopAll: () => ipcRenderer.invoke('browser:stopAll'),
  getRunning: () => ipcRenderer.invoke('browser:getRunning'),
 },
 onStatusUpdate: (callback) => {
  ipcRenderer.on('browser:status-update', (event, status) => callback(status));
 },
 removeStatusListener: () => {
  ipcRenderer.removeAllListeners('browser:status-update');
 },
});