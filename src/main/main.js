const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const AccountManager = require('./account-manager');
const BrowserEngine = require('./browser-engine');

let mainWindow;
let accountManager;
let browserEngine;

function createWindow() {
 accountManager = new AccountManager();
 browserEngine = new BrowserEngine();

 mainWindow = new BrowserWindow({
 width: 1200,
 height: 800,
 minWidth: 900,
 minHeight: 600,
 title: 'Base Automation',
 webPreferences: {
 preload: path.join(__dirname, 'preload.js'),
 contextIsolation: true,
 nodeIntegration: false,
 },
 });

 mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
 mainWindow.setMenuBarVisibility(false);

 mainWindow.webContents.openDevTools();

 // IPC Handlers - Account
 ipcMain.handle('account:getAll', () => {
 return accountManager.getAll();
 });

 ipcMain.handle('account:add', (event, accountData) => {
 return accountManager.add(accountData);
 });

 ipcMain.handle('account:update', (event, id, accountData) => {
 return accountManager.update(id, accountData);
 });

 ipcMain.handle('account:delete', (event, id) => {
 return accountManager.delete(id);
 });

 // IPC Handlers - Browser
 ipcMain.handle('browser:launch', (event, accountIds) => {
 return browserEngine.launchMultiple(accountIds, accountManager, (status) => {
 if (mainWindow && !mainWindow.isDestroyed()) {
 mainWindow.webContents.send('browser:status-update', status);
 }
 });
 });

 ipcMain.handle('browser:stop', (event, accountId) => {
 return browserEngine.stop(accountId);
 });

 ipcMain.handle('browser:stopAll', () => {
 return browserEngine.stopAll();
 });

 ipcMain.handle('browser:getRunning', () => {
 return browserEngine.getRunningAccounts();
 });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
 if (browserEngine) await browserEngine.stopAll();
 if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
 if (BrowserWindow.getAllWindows().length === 0) createWindow();
});