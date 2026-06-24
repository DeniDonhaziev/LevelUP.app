/**
 * Полный деплой на tracker-mobile.expo.app.
 * Первая загрузка (tarball) — через curl/https без keep-alive (обход ECONNRESET).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const projectDir = path.join(__dirname, '..');

function resolveEasRoot() {
  const candidates = [];
  try {
    candidates.push(
      path.join(path.dirname(require.resolve('eas-cli/package.json')), 'build')
    );
  } catch {
    /* local devDependency not installed yet */
  }
  const appData = process.env.APPDATA || path.join(process.env.HOME || '', 'AppData', 'Roaming');
  candidates.push(path.join(appData, 'npm', 'node_modules', 'eas-cli', 'build'));
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, 'worker', 'deployment.js'))) return root;
  }
  throw new Error(
    'Не найден eas-cli. Выполните: npm install  (в package.json есть devDependency eas-cli)'
  );
}

const easRoot = resolveEasRoot();

const createGraphqlClient =
  require(path.join(easRoot, 'commandUtils/context/contextUtils/createGraphqlClient')).createGraphqlClient;
const WorkerAssets = require(path.join(easRoot, 'worker/assets'));
const deployment = require(path.join(easRoot, 'worker/deployment'));
const upload = require(path.join(easRoot, 'worker/upload'));
const logs = require(path.join(easRoot, 'worker/utils/logs'));

function log(msg) {
  console.log(`>> ${msg}`);
}

/** Inter из CDN (+html.tsx); Ionicons/vector-icons .ttf оставляем — иначе иконки в UI пустые. */
function shouldStripWebFont(fullPath) {
  const p = fullPath.replace(/\\/g, '/').toLowerCase();
  if (p.includes('vector-icons') || p.includes('react-native-vector-icons')) return false;
  return p.includes('expo-google-fonts') || p.includes('/inter/') || /inter_\d+/.test(p);
}

function stripBundledFontsFromDist(exportPath) {
  let removed = 0;
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ttf') && shouldStripWebFont(full)) {
        fs.unlinkSync(full);
        removed++;
      }
    }
  }
  walk(exportPath);
  if (removed) log(`удалено ${removed} Inter .ttf из dist (CDN на web)`);
}

const PUBLIC_ROOT_FILES = [
  'favicon.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'manifest.webmanifest',
  'sw.js',
  'fcm-sw-config.js',
];

function syncPublicRootToDist(exportPath) {
  const publicDir = path.join(projectDir, 'public');
  let copied = 0;
  for (const name of PUBLIC_ROOT_FILES) {
    const src = path.join(publicDir, name);
    const dest = path.join(exportPath, name);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, dest);
    copied++;
  }
  if (copied) log(`скопировано ${copied} файлов из public/ в dist/`);
}

function readAuth() {
  if (process.env.EXPO_TOKEN) {
    return { accessToken: process.env.EXPO_TOKEN, sessionSecret: null };
  }
  const statePath = path.join(process.env.USERPROFILE || process.env.HOME, '.expo', 'state.json');
  if (!fs.existsSync(statePath)) {
    throw new Error('Нет сессии Expo. Выполните: npx eas-cli login  или задайте EXPO_TOKEN');
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const sessionSecret = state?.auth?.sessionSecret;
  if (!sessionSecret) {
    throw new Error('Сессия Expo истекла. Выполните: npx eas-cli login');
  }
  return { accessToken: null, sessionSecret };
}

function readProjectId() {
  const appConfig = require(path.join(projectDir, 'app.config.js'));
  return appConfig?.expo?.extra?.eas?.projectId;
}

function parsePendingDeploymentId(body) {
  if (!body) return null;
  const m = String(body).match(/for ["']([a-z0-9][a-z0-9-]*--[a-z0-9]+)["']/i);
  return m ? m[1] : null;
}

function isTarballUploadOk(result) {
  if (!result?.body) return false;
  try {
    const json = JSON.parse(result.body);
    return Boolean(json?.success && json?.result?.token);
  } catch {
    return false;
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout (${Math.round(ms / 1000)}s)`)), ms)
    ),
  ]);
}

/** Одна быстрая попытка — signed URL живёт ~60 сек. */
async function uploadTarballOnce(url, filePath) {
  const host = new URL(url).hostname;
  const port = new URL(url).port || '443';
  log(`curl → ${EXPO_IPV4[0]} (${host}, до 30 сек)…`);
  const curl = runCurlAttempt(
    url,
    filePath,
    path.join(os.tmpdir(), `eas-u-${Date.now()}.json`),
    path.join(os.tmpdir(), `eas-h-${Date.now()}.hdr`),
    ['--resolve', `${host}:${port}:${EXPO_IPV4[0]}`]
  );
  if (curl && (isTarballUploadOk(curl) || curl.body)) {
    if (isTarballUploadOk(curl)) log('tarball загружен');
    return curl;
  }
  throw new Error('curl upload failed');
}

function parseHttpStatusFromHeaders(headerText) {
  const m = headerText.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/m);
  return m ? parseInt(m[1], 10) : 0;
}

const EXPO_IPV4 = ['8.6.112.6', '8.47.69.6'];

function spawnCurl(url, filePath) {
  const { spawnSync } = require('child_process');
  const stamp = Date.now();
  const outFile = path.join(os.tmpdir(), `eas-upload-${stamp}.json`);
  const hdrFile = path.join(os.tmpdir(), `eas-upload-${stamp}.hdr`);
  const host = new URL(url).hostname;
  const port = new URL(url).port || '443';

  for (const ip of EXPO_IPV4) {
    log(`curl → ${ip} (${host}, до 45 сек)…`);
    const result = runCurlAttempt(url, filePath, outFile, hdrFile, [
      '--resolve',
      `${host}:${port}:${ip}`,
    ]);
    if (result) return result;
  }
  log('curl: отправка на eas.expo.app (до 45 сек)…');
  return runCurlAttempt(url, filePath, outFile, hdrFile, []);
}

function runCurlAttempt(url, filePath, outFile, hdrFile, extraArgs) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(
    'curl.exe',
    [
      ...extraArgs,
      '--ipv4',
      '--http1.1',
      '--retry',
      '2',
      '--retry-delay',
      '1',
      '--connect-timeout',
      '15',
      '--max-time',
      '30',
      '-S',
      '-s',
      '-D',
      hdrFile,
      '-o',
      outFile,
      '-X',
      'POST',
      '-H',
      'Expect:',
      '-H',
      'Connection: close',
      '--data-binary',
      `@${filePath}`,
      url,
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  if (r.error) {
    console.warn('curl.exe:', r.error.message);
    return null;
  }
  let code = 0;
  let hdr = '';
  try {
    hdr = fs.readFileSync(hdrFile, 'utf8');
    code = parseHttpStatusFromHeaders(hdr);
  } catch {
    code = 0;
  }
  let body = '';
  try {
    body = fs.readFileSync(outFile, 'utf8');
  } catch {
    body = '';
  }
  try {
    fs.unlinkSync(outFile);
    fs.unlinkSync(hdrFile);
  } catch {
    /* ignore */
  }
  let status = Number.isFinite(code) ? code : 0;
  if (body) {
    try {
      const parsed = JSON.parse(body);
      if (parsed?.success && parsed?.result?.token) {
        if (r.status !== 0) {
          console.warn('curl exit', r.status, '— JSON ответ валиден, продолжаем');
        }
        if (!status || status < 200 || status >= 300) status = 200;
        return { status, body };
      }
    } catch {
      /* not JSON yet */
    }
  }
  if (body && /deployment is already in progress|cannot be restarted/i.test(body)) {
    return { status: code || 400, body };
  }
  if (!Number.isFinite(code) || code < 200 || code >= 300) {
    console.warn('curl exit', r.status, (r.stderr || '').slice(0, 300));
    if (body) console.warn('body:', body.slice(0, 300));
    return null;
  }
  return { status: code, body };
}

function uploadHttps(url, filePath) {
  const host = new URL(url).hostname;
  const port = Number(new URL(url).port || 443);
  const pathAndQuery = new URL(url).pathname + new URL(url).search;
  const stat = fs.statSync(filePath);
  const data = fs.readFileSync(filePath);

  function tryConnect(ip) {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          host: ip || host,
          servername: host,
          path: pathAndQuery,
          method: 'POST',
          headers: {
            'Content-Length': stat.size,
            Host: host,
            Connection: 'close',
          },
          agent: new https.Agent({ keepAlive: false, family: 4 }),
          timeout: 45_000,
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
          );
        }
      );
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('HTTPS upload timeout (45s)')));
      req.end(data);
    });
  }

  return (async () => {
    for (const ip of EXPO_IPV4) {
      try {
        log(`https → ${ip} (${host})…`);
        return await tryConnect(ip);
      } catch (e) {
        console.warn(`https ${ip}:`, e.message || e);
      }
    }
    return tryConnect(null);
  })();
}

function parseUploadResponse(result, uploadUrl) {
  if (result.status === 413) throw new Error('Архив слишком большой для Expo Hosting');
  if (
    result.status === 400 &&
    /deployment is already in progress|already in progress|cannot be restarted/i.test(
      result.body || ''
    )
  ) {
    const pendingId = parsePendingDeploymentId(result.body);
    throw new Error(
      pendingId ? `DEPLOYMENT_IN_PROGRESS:${pendingId}` : 'DEPLOYMENT_IN_PROGRESS'
    );
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload HTTP ${result.status}: ${result.body?.slice(0, 400)}`);
  }
  const json = JSON.parse(result.body);
  if (!json.success || !json.result?.token) {
    throw new Error(json.message || 'Upload tarball failed');
  }
  const { id, fullName, token, upload: uploadList } = json.result;
  const baseURL = new URL('/', uploadUrl).toString();
  return { id, fullName, token, upload: uploadList, baseURL };
}

async function main() {
  process.chdir(projectDir);
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  process.env.NODE_OPTIONS = '--dns-result-order=ipv4first';

  if (process.env.SKIP_EXPORT === '1') {
    log('пропуск export — загрузка готового dist/');
  } else {
    log('export:web');
    execSync('npm run export:web', { stdio: 'inherit', cwd: projectDir });
  }

  const exportPath = path.join(projectDir, 'dist');
  if (!fs.statSync(exportPath).isDirectory()) {
    throw new Error('Нет папки dist — сначала expo export');
  }

  syncPublicRootToDist(exportPath);
  stripBundledFontsFromDist(exportPath);

  const projectId = readProjectId();
  if (!projectId) throw new Error('Нет eas.projectId');
  const graphqlClient = createGraphqlClient(readAuth());

  log('сборка манифеста и assets…');
  const manifestResult = await WorkerAssets.createManifestAsync(
    { environment: 'production', projectDir, projectId },
    graphqlClient
  );
  const assetFiles = await WorkerAssets.collectAssetsAsync(exportPath, {
    maxFileSize: 5e8,
  });

  async function* emitWorkerTarballAsync(params) {
    yield ['assets.json', JSON.stringify(params.assetMap)];
    yield ['manifest.json', JSON.stringify(params.manifest)];
    yield ['routes.json', JSON.stringify(params.routesConfig)];
  }

  const tarPath = await WorkerAssets.packFilesIterableAsync(
    emitWorkerTarballAsync({
      routesConfig: await WorkerAssets.getRoutesConfigAsync(exportPath),
      assetMap: WorkerAssets.assetsToAssetsMap(assetFiles),
      manifest: manifestResult.manifest,
    }),
    { level: 9 }
  );

  log('получаем URL для загрузки (действует ~60 сек)…');
  let deployResult;
  let baseURL;
  let resumeDeploymentId = process.env.EAS_RESUME_DEPLOYMENT_ID || null;
  const deletedPending = new Set();
  const maxUploadAttempts = 12;
  for (let attempt = 1; attempt <= maxUploadAttempts; attempt++) {
    if (attempt > 1) {
      log(`повтор (${attempt}/${maxUploadAttempts})…`);
      await new Promise((r) => setTimeout(r, 400));
    }
    if (resumeDeploymentId) {
      log(`режим продолжения деплоя: ${resumeDeploymentId}`);
    }
    const uploadUrl = await deployment.getSignedDeploymentUrlAsync(graphqlClient, {
      appId: projectId,
      deploymentIdentifier: resumeDeploymentId || undefined,
      nonInteractive: true,
    });
    log(`upload tarball (${(fs.statSync(tarPath).size / 1024).toFixed(1)} KB)…`);
    try {
      const raw = await uploadTarballOnce(uploadUrl, tarPath);
      deployResult = parseUploadResponse(raw, uploadUrl);
      baseURL = deployResult.baseURL;
      break;
    } catch (e) {
      const msg = e.message || String(e);
      console.warn(`tarball ${attempt}/${maxUploadAttempts}:`, msg);
      if (/Token has expired|403/.test(msg)) {
        resumeDeploymentId = null;
        continue;
      }
      if (msg.includes('DEPLOYMENT_IN_PROGRESS')) {
        const pendingId = msg.includes(':') ? msg.split(':').slice(1).join(':') : null;
        if (pendingId && !deletedPending.has(pendingId)) {
          deletedPending.add(pendingId);
          log(`снимаем блокировку — удаляем зависший деплой ${pendingId}…`);
          try {
            await deployment.deleteWorkerDeploymentAsync({
              graphqlClient,
              appId: projectId,
              deploymentIdentifier: pendingId,
            });
            log(`удалён ${pendingId}, начинаем новый деплой`);
            resumeDeploymentId = null;
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          } catch (delErr) {
            console.warn('удаление не удалось, продолжаем тот же деплой:', delErr.message || delErr);
            resumeDeploymentId = pendingId;
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
        }
        if (!pendingId) {
          log('DEPLOYMENT_IN_PROGRESS без ID — удаляем последние не-production деплои…');
          try {
            const page = await require(path.join(easRoot, 'worker/queries')).DeploymentsQuery.getAllDeploymentsPaginatedAsync(
              graphqlClient,
              { appId: projectId, first: 5 }
            );
            for (const edge of page.edges || []) {
              const id = edge.node.deploymentIdentifier;
              if (!id || deletedPending.has(id)) continue;
              deletedPending.add(id);
              try {
                await deployment.deleteWorkerDeploymentAsync({
                  graphqlClient,
                  appId: projectId,
                  deploymentIdentifier: id,
                });
                log(`удалён блокирующий деплой ${id}`);
              } catch {
                /* production alias — пропускаем */
              }
            }
            resumeDeploymentId = null;
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          } catch (listErr) {
            console.warn('не удалось очистить деплои:', listErr.message || listErr);
          }
        }
        if (pendingId) resumeDeploymentId = pendingId;
        else await new Promise((r) => setTimeout(r, 5000));
      }
      if (attempt === maxUploadAttempts) {
        throw new Error(
          `${msg}\n\nПодсказка: npm run deploy:cancel ${resumeDeploymentId || 'ID'} — затем npm run deploy:expo`
        );
      }
    }
  }

  log('upload assets…');
  const uploadInit = { baseURL: new URL('/asset/', baseURL), method: 'POST' };
  uploadInit.baseURL.searchParams.set('token', deployResult.token);

  const assetsBySHA512 = assetFiles.reduce((map, asset) => {
    map.set(asset.sha512, asset);
    return map;
  }, new Map());

  const uploadPayloads = [];
  if (deployResult.upload) {
    for (const instruction of deployResult.upload) {
      const assets = instruction.sha512
        .map((sha) => assetsBySHA512.get(sha))
        .filter(Boolean);
      if (assets.length > 1) uploadPayloads.push({ multipart: assets });
      else if (assets.length === 1) uploadPayloads.push({ asset: assets[0] });
    }
  } else {
    for (const asset of assetFiles) uploadPayloads.push({ asset });
  }

  const progress = upload.createProgressBar(`Uploading ${uploadPayloads.length} assets`);
  try {
    for await (const signal of upload.batchUploadAsync(uploadInit, uploadPayloads, progress.update)) {
      progress.update(signal.progress);
    }
  } finally {
    progress.stop();
  }

  log('finalize…');
  const finalizeUrl = new URL('/deploy/finalize', baseURL);
  finalizeUrl.searchParams.set('token', deployResult.token);
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await upload.callUploadApiAsync(finalizeUrl, {
        method: 'POST',
        headers: { accept: 'application/json' },
      });
      break;
    } catch (e) {
      console.warn(`finalize attempt ${attempt}:`, e.message || e);
      if (attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }

  log('promote → production');
  const production = await deployment.assignWorkerDeploymentProductionAsync({
    graphqlClient,
    appId: projectId,
    deploymentId: deployResult.id,
  });

  const deployUrl = logs.getDeploymentUrlFromFullName(deployResult.fullName);
  const prodUrl = production?.url || deployUrl;

  console.log('\n🎉 Деплой готов\n');
  console.log(`   Production: ${prodUrl}`);
  console.log(`   Preview:    ${deployUrl}`);
  if (prodUrl.includes('tracker-mobile')) {
    console.log('\n   https://tracker-mobile.expo.app/');
  }
}

main().catch((e) => {
  console.error('\n× Deploy failed:', e.message || e);
  process.exit(1);
});
