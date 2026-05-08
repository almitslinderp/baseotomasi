var api = window.api;
var accounts = [];
var selectedIds = new Set();
var runningStatuses = {};

var accountListEl = document.getElementById('account-list');
var statusGridEl = document.getElementById('status-grid');
var runningCountEl = document.getElementById('running-count');
var btnAddAccount = document.getElementById('btn-add-account');
var btnLaunchSelected = document.getElementById('btn-launch-selected');
var btnStopAll = document.getElementById('btn-stop-all');
var btnDeleteSelected = document.getElementById('btn-delete-selected');
var modalOverlay = document.getElementById('modal-overlay');
var modalTitle = document.getElementById('modal-title');
var accountForm = document.getElementById('account-form');
var btnModalClose = document.getElementById('btn-modal-close');
var btnModalCancel = document.getElementById('btn-modal-cancel');
var formAccountId = document.getElementById('form-account-id');
var formName = document.getElementById('form-name');
var formProxy = document.getElementById('form-proxy');
var formNotes = document.getElementById('form-notes');

console.log('renderer.js loaded, api:', typeof api);
console.log('btnAddAccount:', btnAddAccount);

function escapeHtml(str) {
 var div = document.createElement('div');
 div.textContent = str;
 return div.innerHTML;
}

function updateRunningCount() {
 var count = Object.values(runningStatuses).filter(function(s) { return s === 'running' || s === 'launching'; }).length;
 runningCountEl.textContent = count + ' Running';
}

function renderAccountList() {
 if (accounts.length === 0) {
 accountListEl.innerHTML = '<div class=("empty-state")>No accounts yet.</div>';
 btnLaunchSelected.disabled = true;
 return;
 }
 var html = '';
 for (var i = 0; i < accounts.length; i++) {
 var acc = accounts[i];
 var sel = selectedIds.has(acc.id) ? 'selected' : '';
 var st = runningStatuses[acc.id] || 'stopped';
 html += '<div class="account-item ' + sel + '" data-id="' + acc.id + '">';
 html += '<div class="checkbox"></div>';
 html += '<div class="status-dot ' + st + '"></div>';
 html += '<div class="account-info">';
 html += '<div class="account-name">' + escapeHtml(acc.name) + '</div>';
 html += '<div class="account-meta">' + (acc.proxy ? 'Proxy: ' + escapeHtml(acc.proxy) : 'No proxy') + '</div>';
 html += '</div>';
 html += '<div class="account-actions">';
 html += '<button class="btn-edit" data-id="' + acc.id + '">&#9998;</button>';
 html += '<button class="btn-delete" data-id="' + acc.id + '">&#128465;</button>';
 html += '</div></div>';
 }
 accountListEl.innerHTML = html;
 var items = accountListEl.querySelectorAll('.account-item');
 for (var j = 0; j < items.length; j++) {
 (function(el) {
 el.addEventListener('click', function(e) {
 if (e.target.closest('.account-actions')) return;
 toggleSelection(el.dataset.id);
 });
 })(items[j]);
 }
 var edits = accountListEl.querySelectorAll('.btn-edit');
 for (var k = 0; k < edits.length; k++) {
 (function(el) {
 el.addEventListener('click', function(e) {
 e.stopPropagation();
 openEditModal(el.dataset.id);
 });
 })(edits[k]);
 }
 var dels = accountListEl.querySelectorAll('.btn-delete');
 for (var m = 0; m < dels.length; m++) {
 (function(el) {
 el.addEventListener('click', function(e) {
 e.stopPropagation();
 deleteAccount(el.dataset.id);
 });
 })(dels[m]);
 }
 btnLaunchSelected.disabled = selectedIds.size === 0;
 btnDeleteSelected.disabled = selectedIds.size === 0;
}

function renderStatusGrid() {
 var entries = Object.entries(runningStatuses);
 var active = [];
 for (var i = 0; i < entries.length; i++) {
 if (entries[i][1] !== 'stopped') active.push(entries[i]);
 }
 if (active.length === 0) {
 statusGridEl.innerHTML = '<div class="empty-state-large"><p>Select accounts and click Launch Selected.</p></div>';
 btnStopAll.disabled = true;
 return;
 }
 btnStopAll.disabled = false;
 var html = '';
 for (var j = 0; j < active.length; j++) {
 var aid = active[j][0], st = active[j][1];
 var acc = null;
 for (var k = 0; k < accounts.length; k++) { if (accounts[k].id === aid) { acc = accounts[k]; break; } }
 var nm = acc ? acc.name : aid;
 var px = acc && acc.proxy ? acc.proxy : 'None';
 html += '<div class="status-card">';
 html += '<div class="status-card-header">';
 html += '<span class="status-card-name">' + escapeHtml(nm) + '</span>';
 html += '<span class="status-card-status ' + st + '">' + st + '</span>';
 html += '</div>';
 html += '<div class="status-card-body">';
 html += '<div>Profile: ' + aid + '</div>';
 html += '<div>Proxy: ' + escapeHtml(px) + '</div>';
 html += '<div>Device: iPhone 14</div>';
 html += '</div>';
 html += '<div class="status-card-actions">';
 html += '<button class="btn btn-danger-sm btn-stop" data-id="' + aid + '">Stop</button>';
 html += '</div></div>';
 }
 statusGridEl.innerHTML = html;
 var stops = statusGridEl.querySelectorAll('.btn-stop');
 for (var s = 0; s < stops.length; s++) {
 (function(el) {
 el.addEventListener('click', function() { stopBrowser(el.dataset.id); });
 })(stops[s]);
 }
}

function toggleSelection(id) {
 if (selectedIds.has(id)) selectedIds.delete(id);
 else selectedIds.add(id);
 renderAccountList();
}

function openAddModal() {
 console.log('openAddModal called');
 modalTitle.textContent = 'Add Account';
 formAccountId.value = '';
 formName.value = '';
 formProxy.value = '';
 formNotes.value = '';
 modalOverlay.classList.remove('hidden');
 formName.focus();
}

function openEditModal(id) {
 var acc = null;
 for (var i = 0; i < accounts.length; i++) { if (accounts[i].id === id) { acc = accounts[i]; break; } }
 if (!acc) return;
 modalTitle.textContent = 'Edit Account';
 formAccountId.value = acc.id;
 formName.value = acc.name;
 formProxy.value = acc.proxy || '';
 formNotes.value = acc.notes || '';
 modalOverlay.classList.remove('hidden');
 formName.focus();
}

function closeModal() {
 modalOverlay.classList.add('hidden');
}

function handleFormSubmit(e) {
 e.preventDefault();
 var data = {
 name: formName.value.trim(),
 proxy: formProxy.value.trim(),
 notes: formNotes.value.trim(),
 };
 if (!data.name) { formName.focus(); return; }
 if (formAccountId.value) {
 api.account.update(formAccountId.value, data).then(function(updated) {
 for (var i = 0; i < accounts.length; i++) { if (accounts[i].id === updated.id) { accounts[i] = updated; break; } }
 closeModal();
 renderAccountList();
 });
 } else {
 api.account.add(data).then(function(newAcc) {
 accounts.push(newAcc);
 closeModal();
 renderAccountList();
 });
 }
}

function launchSelected() {
 if (selectedIds.size === 0) return;
 var ids = Array.from(selectedIds);
 for (var i = 0; i < ids.length; i++) runningStatuses[ids[i]] = 'launching';
 renderStatusGrid();
 updateRunningCount();
 api.browser.launch(ids);
}

function stopBrowser(accountId) {
 api.browser.stop(accountId).then(function() {
 runningStatuses[accountId] = 'stopped';
 renderAccountList();
 renderStatusGrid();
 updateRunningCount();
 });
}

function stopAllBrowsers() {
 api.browser.stopAll().then(function() {
 runningStatuses = {};
 renderAccountList();
 renderStatusGrid();
 updateRunningCount();
 });
}

function deleteAccount(id) {
 var acc = null;
 for (var i = 0; i < accounts.length; i++) { if (accounts[i].id === id) { acc = accounts[i]; break; } }
 if (!acc) return;
 if (!confirm('Delete ' + acc.name + '?')) return;
 if (runningStatuses[id] && runningStatuses[id] !== 'stopped') api.browser.stop(id);
 api.account.delete(id).then(function() {
 accounts = accounts.filter(function(a) { return a.id !== id; });
 selectedIds.delete(id);
 delete runningStatuses[id];
 renderAccountList();
 renderStatusGrid();
 updateRunningCount();
 });
}

function deleteSelected() {
 if (selectedIds.size === 0) return;
 if (!confirm('Delete ' + selectedIds.size + ' selected accounts and their Chrome profiles?')) return;
 var ids = Array.from(selectedIds);
 var done = 0;
 for (var i = 0; i < ids.length; i++) {
 (function(id) {
 if (runningStatuses[id] && runningStatuses[id] !== 'stopped') api.browser.stop(id);
 api.account.delete(id).then(function() {
 accounts = accounts.filter(function(a) { return a.id !== id; });
 selectedIds.delete(id);
 delete runningStatuses[id];
 done++;
 if (done === ids.length) {
 renderAccountList();
 renderStatusGrid();
 updateRunningCount();
 }
 });
 })(ids[i]);
 }
}

// Event listeners
btnAddAccount.addEventListener('click', openAddModal);
btnLaunchSelected.addEventListener('click', launchSelected);
btnStopAll.addEventListener('click', stopAllBrowsers);
btnDeleteSelected.addEventListener('click', deleteSelected);
btnModalClose.addEventListener('click', closeModal);
btnModalCancel.addEventListener('click', closeModal);
accountForm.addEventListener('submit', handleFormSubmit);
modalOverlay.addEventListener('click', function(e) {
 if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', function(e) {
 if (e.key === 'Escape') closeModal();
});

console.log('Event listeners attached');

// Init
api.account.getAll().then(function(accs) {
 accounts = accs;
 return api.browser.getRunning();
}).then(function(running) {
 for (var i = 0; i < running.length; i++) runningStatuses[running[i]] = 'running';
 renderAccountList();
 renderStatusGrid();
 updateRunningCount();
 api.onStatusUpdate(function(status) {
 runningStatuses[status.accountId] = status.status;
 renderAccountList();
 renderStatusGrid();
 updateRunningCount();
 });
 console.log('Init complete, accounts:', accounts.length);
});