// Локальный git только для tracker-mobile + сборка APK в EAS.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function run(cmd, opts = {}) {
  console.log('>>', cmd);
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
}

if (!fs.existsSync(path.join(root, '.git'))) {
  run('git init -b main');
  run('git add .');
  try {
    run('git commit -m "build: snapshot for EAS APK"');
  } catch {
    console.warn('commit skipped (nothing to commit or hook failed)');
  }
}

run('npx eas-cli build --platform android --profile apk --non-interactive');
