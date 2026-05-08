const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const PROFILES_DIR = path.join(__dirname, '..', '..', 'profiles');

const MOBILE_DEVICES = {
 'iPhone 14': {
 viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
 userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
 },
 'Samsung Galaxy S21': {
 viewport: { width: 360, height: 800, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
 userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
 },
 'Pixel 7': {
 viewport: { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
 userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
 },
};

const DEFAULT_DEVICE = 'iPhone 14';

class BrowserEngine {
 constructor() {
 this.runningBrowsers = new Map();
 this._ensureProfilesDir();
 }

 _ensureProfilesDir() {
 if (!fs.existsSync(PROFILES_DIR)) {
 fs.mkdirSync(PROFILES_DIR, { recursive: true });
 }
 }

 _findChromePath() {
 const possiblePaths = [
 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
 (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 '/usr/bin/google-chrome',
 '/usr/bin/google-chrome-stable',
 '/usr/bin/chromium-browser',
 '/usr/bin/chromium',
 ];
 for (const p of possiblePaths) {
 if (fs.existsSync(p)) return p;
 }
 throw new Error('Chrome not found! Please install Google Chrome.');
 }

 async launch(account, onStatus, deviceName) {
 const accountId = account.id;
 if (this.runningBrowsers.has(accountId)) {
 if (onStatus) onStatus({ accountId, status: 'already_running' });
 return;
 }
 const profilePath = path.join(PROFILES_DIR, accountId);
 const device = MOBILE_DEVICES[deviceName] || MOBILE_DEVICES[DEFAULT_DEVICE];
 try {
 if (onStatus) onStatus({ accountId, status: 'launching' });
 const launchArgs = [
 '--no-sandbox',
 '--disable-setuid-sandbox',
 '--disable-infobars',
 '--disable-blink-features=AutomationControlled',
 '--window-size=' + device.viewport.width + ',' + (device.viewport.height + 100),
 ];
 if (account.proxy) {
 launchArgs.push('--proxy-server=' + account.proxy);
 }
 const browser = await puppeteer.launch({
 headless: false,
 executablePath: this._findChromePath(),
 userDataDir: profilePath,
 args: launchArgs,
 defaultViewport: device.viewport,
 ignoreDefaultArgs: ['--enable-automation'],
 });
 const pages = await browser.pages();
 const page = pages[0] || await browser.newPage();
 await page.setUserAgent(device.userAgent);
 await page.setViewport(device.viewport);
 await page.evaluateOnNewDocument(function() {
 Object.defineProperty(navigator, 'maxTouchPoints', { get: function() { return 5; } });
 Object.defineProperty(navigator, 'platform', { get: function() { return 'iPhone'; } });
 Object.defineProperty(navigator, 'webdriver', { get: function() { return false; } });
 });
 this.runningBrowsers.set(accountId, browser);
 var self = this;
 browser.on('disconnected', function() {
 self.runningBrowsers.delete(accountId);
 if (onStatus) onStatus({ accountId, status: 'stopped' });
 });
 if (onStatus) onStatus({ accountId, status: 'running' });
 return { success: true, accountId: accountId };
 } catch (err) {
 if (onStatus) onStatus({ accountId, status: 'error', message: err.message });
 return { success: false, accountId: accountId, error: err.message };
 }
 }

 async launchMultiple(accountIds, accountManager, onStatus) {
 var self = this;
 const results = await Promise.allSettled(
 accountIds.map(function(id) {
 const account = accountManager.getById(id);
 if (!account) {
 if (onStatus) onStatus({ accountId: id, status: 'error', message: 'Account not found' });
 return Promise.reject(new Error('Account not found'));
 }
 return self.launch(account, onStatus);
 })
 );
 return results.map(function(r, i) {
 return {
 accountId: accountIds[i],
 success: r.status === 'fulfilled',
 error: r.status === 'rejected' ? (r.reason ? r.reason.message : undefined) : undefined,
 };
 });
 }

 async stop(accountId) {
 const browser = this.runningBrowsers.get(accountId);
 if (browser) {
 try { await browser.close(); } catch (e) {}
 this.runningBrowsers.delete(accountId);
 }
 }

 async stopAll() {
 const promises = [];
 var self = this;
 for (const [id, browser] of this.runningBrowsers) {
 promises.push(
 browser.close().catch(function() {}).then(function() { self.runningBrowsers.delete(id); })
 );
 }
 await Promise.allSettled(promises);
 }

 getRunningAccounts() {
 return Array.from(this.runningBrowsers.keys());
 }
}

module.exports = BrowserEngine;