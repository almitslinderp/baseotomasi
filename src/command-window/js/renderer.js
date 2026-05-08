var api = window.commandApi;
var platforms = [];
var currentActions = [];
var isRunning = false;

var accountSelect = document.getElementById('account-select');
var platformSelect = document.getElementById('platform-select');
var actionSelect = document.getElementById('action-select');
var paramsContainer = document.getElementById('params-container');
var btnRun = document.getElementById('btn-run');
var btnStop = document.getElementById('btn-stop');
var btnClearLog = document.getElementById('btn-clear-log');
var logOutput = document.getElementById('log-output');
var execStatus = document.getElementById('exec-status');

function timestamp() {
  var d = new Date();
  var h = String(d.getHours()).padStart(2, '0');
  var m = String(d.getMinutes()).padStart(2, '0');
  var s = String(d.getSeconds()).padStart(2, '0');
  return h + ':' + m + ':' + s;
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function appendLog(message, type) {
  type = type || 'info';
  var entry = document.createElement('div');
  entry.className = 'log-entry log-' + type;
  entry.innerHTML = '<span class="log-time">[' + timestamp() + ']</span>' + escapeHtml(message);
  logOutput.appendChild(entry);
  logOutput.scrollTop = logOutput.scrollHeight;
}

function clearLog() {
  logOutput.innerHTML = '';
  appendLog('Log cleared.', 'info');
}

function setStatus(status) {
  execStatus.textContent = status;
  execStatus.className = 'badge';
  if (status === 'Running') {
    execStatus.classList.add('badge-running');
  } else if (status === 'Error') {
    execStatus.classList.add('badge-error');
  } else {
    execStatus.classList.add('badge-idle');
  }
}

function updateRunState(running) {
  isRunning = running;
  btnRun.disabled = running || !canRun();
  btnStop.disabled = !running;
  setStatus(running ? 'Running' : 'Idle');
}

function canRun() {
  return accountSelect.value && platformSelect.value && actionSelect.value;
}

function renderParams(action) {
  paramsContainer.innerHTML = '';
  if (!action || !action.params || action.params.length === 0) return;
  for (var i = 0; i < action.params.length; i++) {
    var p = action.params[i];
    var group = document.createElement('div');
    group.className = 'param-group';
    var label = document.createElement('label');
    label.textContent = p.label + (p.required ? ' *' : '');
    label.setAttribute('for', 'param-' + p.name);
    var input;
    if (p.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = p.rows || 5;
    } else {
      input = document.createElement('input');
      input.type = p.type || 'text';
    }
    input.id = 'param-' + p.name;
    input.name = p.name;
    input.placeholder = p.placeholder || '';
    if (p.required) input.required = true;
    group.appendChild(label);
    group.appendChild(input);
    paramsContainer.appendChild(group);
  }
}

function getParamValues() {
  var inputs = paramsContainer.querySelectorAll('input, textarea');
  var values = {};
  for (var i = 0; i < inputs.length; i++) {
    values[inputs[i].name] = inputs[i].value.trim();
  }
  return values;
}

function findActionMeta(actionId) {
  for (var i = 0; i < currentActions.length; i++) {
    if (currentActions[i].id === actionId) return currentActions[i];
  }
  return null;
}

// Platform select change
platformSelect.addEventListener('change', function () {
  actionSelect.innerHTML = '<option value="">-- Select Action --</option>';
  actionSelect.disabled = true;
  paramsContainer.innerHTML = '';
  currentActions = [];
  btnRun.disabled = true;

  var name = platformSelect.value;
  if (!name) return;

  for (var i = 0; i < platforms.length; i++) {
    if (platforms[i].name === name) {
      currentActions = platforms[i].actions;
      break;
    }
  }
  if (currentActions.length > 0) {
    actionSelect.disabled = false;
    for (var j = 0; j < currentActions.length; j++) {
      var opt = document.createElement('option');
      opt.value = currentActions[j].id;
      opt.textContent = currentActions[j].label;
      actionSelect.appendChild(opt);
    }
  }
});

// Action select change
actionSelect.addEventListener('change', function () {
  var actionId = actionSelect.value;
  var action = findActionMeta(actionId);
  renderParams(action);
  btnRun.disabled = !canRun();
});

// Account select change
accountSelect.addEventListener('change', function () {
  btnRun.disabled = !canRun();
});

// Run
btnRun.addEventListener('click', function () {
  var accountId = accountSelect.value;
  var platformName = platformSelect.value;
  var actionId = actionSelect.value;
  var params = getParamValues();

  if (!accountId || !platformName || !actionId) return;

  // Validate required params
  var action = findActionMeta(actionId);
  if (action && action.params) {
    for (var i = 0; i < action.params.length; i++) {
      if (action.params[i].required && !params[action.params[i].name]) {
        appendLog('Missing required parameter: ' + action.params[i].label, 'error');
        return;
      }
    }
  }

  appendLog('Executing: ' + platformName + ' > ' + (action ? action.label : actionId), 'action');
  updateRunState(true);

  api.executeCommand(accountId, platformName, actionId, params);
});

// Stop
btnStop.addEventListener('click', function () {
  appendLog('Stopping execution...', 'warn');
  api.stopCommand();
});

// Clear log
btnClearLog.addEventListener('click', clearLog);

// Listen for log messages from main
api.onCommandLog(function (data) {
  appendLog(data.message, data.type || 'info');
});

// Listen for command completion
api.onCommandDone(function (data) {
  if (data.success) {
    appendLog('Command finished successfully.', 'success');
  } else {
    appendLog('Command failed: ' + (data.error || 'Unknown error'), 'error');
  }
  updateRunState(false);
});

// Init: load platforms and accounts
api.getPlatforms().then(function (p) {
  platforms = p;
  for (var i = 0; i < platforms.length; i++) {
    var opt = document.createElement('option');
    opt.value = platforms[i].name;
    opt.textContent = platforms[i].name;
    platformSelect.appendChild(opt);
  }
  appendLog('Loaded ' + platforms.length + ' platform(s): ' + platforms.map(function (x) { return x.name; }).join(', '), 'info');
});

api.getAccounts().then(function (accs) {
  for (var i = 0; i < accs.length; i++) {
    var opt = document.createElement('option');
    opt.value = accs[i].id;
    opt.textContent = accs[i].name;
    accountSelect.appendChild(opt);
  }
  appendLog('Loaded ' + accs.length + ' account(s).', 'info');
});

console.log('Command Center renderer loaded');
