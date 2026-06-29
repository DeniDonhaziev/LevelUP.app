/**
 * Деплой PWA на https://leveluptracker.web.app/
 * export → копирование public/ → firebase hosting
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = path.join(__dirname, '..');
const distDir = path.join(projectDir, 'dist');
const publicDir = path.join(projectDir, 'public');

const PUBLIC_ROOT_FILES = [
  'favicon.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'manifest.webmanifest',
  'sw.js',
  'fcm-sw-config.js',
  'oferta.html',
];

function log(msg) {
  console.log(`>> ${msg}`);
}

function syncPublicRootToDist() {
  let copied = 0;
  for (const name of PUBLIC_ROOT_FILES) {
    const src = path.join(publicDir, name);
    const dest = path.join(distDir, name);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, dest);
    copied++;
  }
  const fontsSrc = path.join(publicDir, 'fonts');
  const fontsDest = path.join(distDir, 'fonts');
  if (fs.existsSync(fontsSrc)) {
    fs.mkdirSync(fontsDest, { recursive: true });
    for (const name of fs.readdirSync(fontsSrc)) {
      fs.copyFileSync(path.join(fontsSrc, name), path.join(fontsDest, name));
      copied++;
    }
  }
  log(`скопировано ${copied} файлов из public/ в dist/`);
}

function run(cmd) {
  log(cmd);
  execSync(cmd, { cwd: projectDir, stdio: 'inherit', env: process.env });
}

run('npm run export:web');
if (!fs.existsSync(distDir)) {
  throw new Error('dist/ не создан после export:web');
}
syncPublicRootToDist();
run('npx firebase deploy --only hosting:leveluptracker --project levelup-ff95c');
log('Готово: https://leveluptracker.web.app/');
