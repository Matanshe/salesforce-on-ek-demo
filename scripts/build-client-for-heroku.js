#!/usr/bin/env node
/**
 * Builds the client for Heroku using API_SECRET from server/.env.
 * Run from repo root: node scripts/build-client-for-heroku.js <heroku-app-name-or-url>
 *
 * Examples:
 *   node scripts/build-client-for-heroku.js my-app
 *   node scripts/build-client-for-heroku.js https://my-app.herokuapp.com
 */
import { execSync } from 'child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadServerEnv, isHeroku } from './lib/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const clientDir = join(repoRoot, 'client');
const distDir = join(clientDir, 'dist');

/** Recursively find all .js files under dir */
function findJsFiles(dir, list = []) {
  if (!existsSync(dir)) return list;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) findJsFiles(path, list);
    else if (name.endsWith('.js')) list.push(path);
  }
  return list;
}

const appArg = process.argv[2];
if (!appArg && !isHeroku) {
  console.error('Usage: node scripts/build-client-for-heroku.js <heroku-app-name-or-url>');
  process.exit(1);
}

const { env, errors } = loadServerEnv();
if (errors.length > 0) {
  console.error('Cannot build: server/.env validation failed:');
  errors.forEach((e) => console.error('  -', e));
  console.error(isHeroku ? '\nSet missing vars in Heroku: heroku config:set KEY=value' : '\nRun: node scripts/validate-env.js');
  process.exit(1);
}

const apiSecret = env.API_SECRET;
if (!apiSecret) {
  console.error('API_SECRET not found (server/.env or Heroku Config Vars)');
  process.exit(1);
}

// On Heroku use VITE_API_URL from Config Vars (required); otherwise use script arg
let viteApiUrl;
if (isHeroku) {
  viteApiUrl = process.env.VITE_API_URL || '';
  if (!viteApiUrl.startsWith('https://')) {
    console.error('On Heroku set VITE_API_URL to your app URL, e.g. heroku config:set VITE_API_URL=https://your-app.herokuapp.com');
    process.exit(1);
  }
} else {
  viteApiUrl = appArg;
  if (!viteApiUrl.startsWith('http')) {
    viteApiUrl = `https://${appArg.replace(/\.herokuapp\.com$/i, '')}.herokuapp.com`;
  }
}

console.log('Building client for', viteApiUrl);
console.log('VITE_API_SECRET length:', apiSecret.length, '(will be inlined into bundle)');
if (isHeroku) {
  console.log('Installing client dependencies (tsc, vite)...');
  execSync('npm install', { cwd: clientDir, stdio: 'inherit' });
}
execSync('npm run build', {
  cwd: clientDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_API_URL: viteApiUrl,
    VITE_API_SECRET: apiSecret,
  },
});

// Verify the secret was inlined (so we don't deploy a bundle that will show "API_SECRET is not configured")
console.log('Verifying API_SECRET is inlined in build output...');
const jsFiles = findJsFiles(distDir);
const snippet = apiSecret.slice(0, 8);
let found = false;
for (const file of jsFiles) {
  try {
    if (readFileSync(file, 'utf8').includes(snippet)) {
      found = true;
      break;
    }
  } catch (_) {}
}
if (jsFiles.length === 0) {
  console.error('Verification failed: no JS files in client/dist/. Build may have failed.');
  process.exit(1);
}
if (!found) {
  console.error('Verification failed: API_SECRET was not found in built JS. The bundle may show "API_SECRET is not configured" in the browser.');
  process.exit(1);
}
console.log('Verified: API_SECRET is inlined in client/dist/');
console.log('Done. Output in client/dist/');
