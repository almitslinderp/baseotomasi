const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

function loadAllCommands() {
  const platforms = [];
  if (!fs.existsSync(COMMANDS_DIR)) {
    fs.mkdirSync(COMMANDS_DIR, { recursive: true });
    return platforms;
  }
  const files = fs.readdirSync(COMMANDS_DIR).filter(function (f) {
    return f.endsWith('.js');
  });
  for (var i = 0; i < files.length; i++) {
    try {
      var mod = require(path.join(COMMANDS_DIR, files[i]));
      if (mod.name && Array.isArray(mod.actions)) {
        platforms.push({
          file: files[i],
          name: mod.name,
          actions: mod.actions.map(function (a) {
            return {
              id: a.id,
              label: a.label,
              params: a.params || [],
            };
          }),
          _raw: mod,
        });
      }
    } catch (err) {
      console.error('Failed to load command file ' + files[i] + ':', err.message);
    }
  }
  return platforms;
}

function getPlatformsMeta(platforms) {
  return platforms.map(function (p) {
    return {
      name: p.name,
      file: p.file,
      actions: p.actions,
    };
  });
}

function findAction(platforms, platformName, actionId) {
  for (var i = 0; i < platforms.length; i++) {
    if (platforms[i].name === platformName) {
      var raw = platforms[i]._raw;
      for (var j = 0; j < raw.actions.length; j++) {
        if (raw.actions[j].id === actionId) {
          return raw.actions[j];
        }
      }
    }
  }
  return null;
}

module.exports = { loadAllCommands, getPlatformsMeta, findAction };
