const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const AccountManager = require('./account-manager');
const BrowserEngine = require('./browser-engine');
const { loadAllCommands, getPlatformsMeta, findAction } = require('./command-loader');

let mainWindow;
let commandWindow;
let accountManager;
let browserEngine;
let platforms;
let activeCommand = null;

function createMainWindow() {
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

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function createCommandWindow() {
  commandWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    title: 'Command Center',
    webPreferences: {
      preload: path.join(__dirname, 'command-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  commandWindow.loadFile(path.join(__dirname, '..', 'command-window', 'index.html'));
  commandWindow.setMenuBarVisibility(false);

  commandWindow.on('closed', function () {
    commandWindow = null;
  });
}

function sendCommandLog(message, type) {
  if (commandWindow && !commandWindow.isDestroyed()) {
    commandWindow.webContents.send('command:log', { message: message, type: type || 'info' });
  }
}

function sendCommandDone(success, error) {
  if (commandWindow && !commandWindow.isDestroyed()) {
    commandWindow.webContents.send('command:done', { success: success, error: error || null });
  }
  activeCommand = null;
}

function setupIPC() {
  // ============ Account IPC (Main Window) ============
  ipcMain.handle('account:getAll', function () {
    return accountManager.getAll();
  });

  ipcMain.handle('account:add', function (event, accountData) {
    return accountManager.add(accountData);
  });

  ipcMain.handle('account:update', function (event, id, accountData) {
    return accountManager.update(id, accountData);
  });

  ipcMain.handle('account:delete', function (event, id) {
    return accountManager.delete(id);
  });

  // ============ Browser IPC (Main Window) ============
  ipcMain.handle('browser:launch', function (event, accountIds) {
    return browserEngine.launchMultiple(accountIds, accountManager, function (status) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:status-update', status);
      }
    });
  });

  ipcMain.handle('browser:stop', function (event, accountId) {
    return browserEngine.stop(accountId);
  });

  ipcMain.handle('browser:stopAll', function () {
    return browserEngine.stopAll();
  });

  ipcMain.handle('browser:getRunning', function () {
    return browserEngine.getRunningAccounts();
  });

  // ============ Command IPC (Command Window) ============
  ipcMain.handle('command:getPlatforms', function () {
    return getPlatformsMeta(platforms);
  });

  ipcMain.handle('command:getAccounts', function () {
    return accountManager.getAll();
  });

  ipcMain.handle('command:execute', async function (event, data) {
    var accountId = data.accountId;
    var platformName = data.platform;
    var actionId = data.actionId;
    var params = data.params;

    if (activeCommand) {
      sendCommandLog('A command is already running. Stop it first.', 'error');
      return { success: false, error: 'Already running' };
    }

    var action = findAction(platforms, platformName, actionId);
    if (!action) {
      sendCommandLog('Action not found: ' + actionId, 'error');
      sendCommandDone(false, 'Action not found');
      return { success: false, error: 'Action not found' };
    }

    var browser = browserEngine.runningBrowsers.get(accountId);
    if (!browser) {
      sendCommandLog('Browser not running for this account. Launching...', 'warn');
      var account = accountManager.getById(accountId);
      if (!account) {
        sendCommandLog('Account not found: ' + accountId, 'error');
        sendCommandDone(false, 'Account not found');
        return { success: false, error: 'Account not found' };
      }
      var launchResult = await browserEngine.launch(account, function (status) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('browser:status-update', status);
        }
        sendCommandLog('Browser status: ' + status.status, 'info');
      });
      if (!launchResult || !launchResult.success) {
        sendCommandLog('Failed to launch browser.', 'error');
        sendCommandDone(false, 'Browser launch failed');
        return { success: false, error: 'Browser launch failed' };
      }
      browser = browserEngine.runningBrowsers.get(accountId);
    }

    activeCommand = { accountId: accountId, aborted: false };

    try {
      var pages = await browser.pages();
      var page = pages[0] || await browser.newPage();

      sendCommandLog('Starting: ' + platformName + ' > ' + action.label, 'action');

      var logFn = function (msg) {
        if (activeCommand && !activeCommand.aborted) {
          sendCommandLog(msg, 'info');
        }
      };

      await action.execute(params, page, logFn);
      sendCommandDone(true);
      return { success: true };
    } catch (err) {
      sendCommandLog('Error: ' + err.message, 'error');
      sendCommandDone(false, err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('command:stop', function () {
    if (activeCommand) {
      activeCommand.aborted = true;
      sendCommandLog('Command aborted by user.', 'warn');
      sendCommandDone(false, 'Aborted by user');
    }
    return { success: true };
  });
}

app.whenReady().then(function () {
  accountManager = new AccountManager();
  browserEngine = new BrowserEngine();
  platforms = loadAllCommands();

  setupIPC();
  createMainWindow();
  createCommandWindow();
});

app.on('window-all-closed', async function () {
  if (browserEngine) await browserEngine.stopAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (!mainWindow) createMainWindow();
  if (!commandWindow) createCommandWindow();
});
