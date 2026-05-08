const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

class AccountManager {
 constructor() {
  this._ensureDataDir();
  this.accounts = this._load();
 }

 _ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
   fs.mkdirSync(DATA_DIR, { recursive: true });
  }
 }

 _load() {
  try {
   if (fs.existsSync(ACCOUNTS_FILE)) {
    const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
    return JSON.parse(raw);
   }
  } catch (err) {
   console.error('Failed to load accounts:', err.message);
  }
  return [];
 }

 _save() {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(this.accounts, null, 2), 'utf-8');
 }

 _generateId() {
  return crypto.randomBytes(8).toString('hex');
 }

 getAll() {
  return [...this.accounts];
 }

 add(data) {
  const account = {
   id: this._generateId(),
   name: data.name || 'Unnamed Account',
   notes: data.notes || '',
   proxy: data.proxy || '',
   createdAt: new Date().toISOString(),
  };
  this.accounts.push(account);
  this._save();
  return account;
 }

 update(id, data) {
  const index = this.accounts.findIndex(a => a.id === id);
  if (index === -1) {
   throw new Error(`Account not found: ${id}`);
  }
  this.accounts[index] = {
   ...this.accounts[index],
   name: data.name !== undefined ? data.name : this.accounts[index].name,
   notes: data.notes !== undefined ? data.notes : this.accounts[index].notes,
   proxy: data.proxy !== undefined ? data.proxy : this.accounts[index].proxy,
  };
  this._save();
  return this.accounts[index];
 }

 delete(id) {
  const index = this.accounts.findIndex(a => a.id === id);
  if (index === -1) {
   throw new Error(`Account not found: ${id}`);
  }
  const removed = this.accounts.splice(index, 1)[0];
  this._save();
  const profileDir = path.join(__dirname, '..', '..', 'profiles', id);
  if (fs.existsSync(profileDir)) {
   fs.rmSync(profileDir, { recursive: true, force: true });
  }
  return removed;
 }

 getById(id) {
  return this.accounts.find(a => a.id === id) || null;
 }
}

module.exports = AccountManager;