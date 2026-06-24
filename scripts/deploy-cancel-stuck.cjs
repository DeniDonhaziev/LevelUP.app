/**
 * Удаляет зависшие деплои Expo Hosting (блокируют новый deploy).
 * Использование:
 *   npm run deploy:cancel
 *   npm run deploy:cancel -- tracker-mobile--abc123 tracker-mobile--def456
 */
const fs = require('fs');
const path = require('path');

const projectDir = path.join(__dirname, '..');

function resolveEasRoot() {
  const candidates = [];
  try {
    candidates.push(
      path.join(path.dirname(require.resolve('eas-cli/package.json')), 'build')
    );
  } catch {
    /* ignore */
  }
  const appData = process.env.APPDATA || path.join(process.env.HOME || '', 'AppData', 'Roaming');
  candidates.push(path.join(appData, 'npm', 'node_modules', 'eas-cli', 'build'));
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, 'worker', 'deployment.js'))) return root;
  }
  throw new Error('Не найден eas-cli. Выполните: npm install');
}

const easRoot = resolveEasRoot();
const createGraphqlClient =
  require(path.join(easRoot, 'commandUtils/context/contextUtils/createGraphqlClient')).createGraphqlClient;
const deployment = require(path.join(easRoot, 'worker/deployment'));
const queries = require(path.join(easRoot, 'worker/queries'));

function readAuth() {
  if (process.env.EXPO_TOKEN) {
    return { accessToken: process.env.EXPO_TOKEN, sessionSecret: null };
  }
  const statePath = path.join(process.env.USERPROFILE || process.env.HOME, '.expo', 'state.json');
  if (!fs.existsSync(statePath)) {
    throw new Error('Нет сессии Expo: npx eas-cli login');
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const sessionSecret = state?.auth?.sessionSecret;
  if (!sessionSecret) throw new Error('Сессия Expo истекла: npx eas-cli login');
  return { accessToken: null, sessionSecret };
}

function readProjectId() {
  return require(path.join(projectDir, 'app.config.js'))?.expo?.extra?.eas?.projectId;
}

async function main() {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const projectId = readProjectId();
  if (!projectId) throw new Error('Нет eas.projectId в app.config.js');
  const graphqlClient = createGraphqlClient(readAuth());

  let toDelete = ids;
  if (!toDelete.length) {
    const page = await queries.DeploymentsQuery.getAllDeploymentsPaginatedAsync(graphqlClient, {
      appId: projectId,
      first: 8,
    });
    toDelete = (page.edges || []).map((e) => e.node.deploymentIdentifier);
    console.log('>> последние деплои:', toDelete.join(', ') || '(нет)');
  }

  for (const deploymentIdentifier of toDelete) {
    try {
      await deployment.deleteWorkerDeploymentAsync({
        graphqlClient,
        appId: projectId,
        deploymentIdentifier,
      });
      console.log('✓ удалён', deploymentIdentifier);
    } catch (e) {
      console.warn('×', deploymentIdentifier, '-', e.message || e);
    }
  }
  console.log('\n>> теперь: npm run deploy:expo');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
