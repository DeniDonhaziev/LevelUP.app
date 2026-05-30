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
const easRoot = path.join(
  process.env.APPDATA || path.join(process.env.HOME, 'AppData', 'Roaming'),
  'npm',
  'node_modules',
  'eas-cli',
  'build'
);

const createGraphqlClient =
  require(path.join(easRoot, 'commandUtils/context/contextUtils/createGraphqlClient')).createGraphqlClient;
const WorkerAssets = require(path.join(easRoot, 'worker/assets'));
const deployment = require(path.join(easRoot, 'worker/deployment'));
const upload = require(path.join(easRoot, 'worker/upload'));
const logs = require(path.join(easRoot, 'worker/utils/logs'));

function log(msg) {
  console.log(`>> ${msg}`);
}

function readAuth() {
  if (process.env.EXPO_TOKEN) {
    return { accessToken: process.env.EXPO_TOKEN, sessionSecret: null };
  }
  const statePath = path.join(process.env.USERPROFILE || process.env.HOME, '.expo', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const sessionSecret = state?.auth?.sessionSecret;
  if (!sessionSecret) {
    throw new Error('Нет сессии Expo. Выполните: npx eas-cli login  или задайте EXPO_TOKEN');
  }
  return { accessToken: null, sessionSecret };
}

function readProjectId() {
  const appConfig = require(path.join(projectDir, 'app.config.js'));
  return appConfig?.expo?.extra?.eas?.projectId;
}

async function uploadTarballRobust(url, filePath) {
  const curl = spawnCurl(url, filePath);
  if (curl) {
    log('загрузка tarball через curl.exe (обход ECONNRESET node-fetch)');
    return curl;
  }
  log('curl не удался — повтор через https (1 попытка, 2 мин)…');
  return uploadHttps(url, filePath);
}

function parseHttpStatusFromHeaders(headerText) {
  const m = headerText.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/m);
  return m ? parseInt(m[1], 10) : 0;
}

function spawnCurl(url, filePath) {
  const { spawnSync } = require('child_process');
  const stamp = Date.now();
  const outFile = path.join(os.tmpdir(), `eas-upload-${stamp}.json`);
  const hdrFile = path.join(os.tmpdir(), `eas-upload-${stamp}.hdr`);
  log('curl: отправка на eas.expo.app (до 3 мин)…');
  const r = spawnSync(
    'curl.exe',
    [
      '--http1.1',
      '--retry',
      '3',
      '--retry-delay',
      '2',
      '--connect-timeout',
      '25',
      '--max-time',
      '180',
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
  if (!Number.isFinite(code) || code < 200 || code >= 300) {
    console.warn('curl exit', r.status, (r.stderr || '').slice(0, 300));
    if (body) console.warn('body:', body.slice(0, 300));
    return null;
  }
  return { status: code, body };
}

function uploadHttps(url, filePath) {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: { 'Content-Length': stat.size },
        agent: new https.Agent({ keepAlive: false }),
        timeout: 120_000,
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
    req.setTimeout(120_000, () => {
      req.destroy(new Error('HTTPS upload timeout (120s)'));
    });
    fs.createReadStream(filePath).pipe(req);
  });
}

function parseUploadResponse(result, uploadUrl) {
  if (result.status === 413) throw new Error('Архив слишком большой для Expo Hosting');
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
    })
  );

  log('получаем URL для загрузки (действует ~60 сек)…');
  const uploadUrl = await deployment.getSignedDeploymentUrlAsync(graphqlClient, {
    appId: projectId,
    deploymentIdentifier: undefined,
    nonInteractive: true,
  });

  log(`upload tarball (${(fs.statSync(tarPath).size / 1024).toFixed(1)} KB)…`);
  const raw = await uploadTarballRobust(uploadUrl, tarPath);
  const deployResult = parseUploadResponse(raw, uploadUrl);
  const baseURL = deployResult.baseURL;

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
  await upload.callUploadApiAsync(finalizeUrl, {
    method: 'POST',
    headers: { accept: 'application/json' },
  });

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
