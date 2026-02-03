#!/usr/bin/env node
/**
 * Builds the client for Heroku using API secret from server/.env.
 * Run from repo root: node scripts/build-client-for-heroku.js <heroku-app-name-or-url>
 *
 * Examples:
 *   node scripts/build-client-for-heroku.js my-app
 *   node scripts/build-client-for-heroku.js https://my-app.herokuapp.com
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const envPath = join(repoRoot, 'server', '.env');
const clientDir = join(repoRoot, 'client');

function parseEnv(path) {
  const env = {};
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const appArg = process.argv[2];
if (!appArg) {
  console.error('Usage: node scripts/build-client-for-heroku.js <heroku-app-name-or-url>');
  process.exit(1);
}

let viteApiUrl = appArg;
if (!viteApiUrl.startsWith('http')) {
  viteApiUrl = `https://${appArg.replace(/\.herokuapp\.com$/i, '')}.herokuapp.com`;
}

const env = parseEnv(envPath);
const apiSecret = env.API_SECRET;
if (!apiSecret) {
  console.error('API_SECRET not found in server/.env');
  process.exit(1);
}

console.log('Building client for', viteApiUrl);
execSync('npm run build', {
  cwd: clientDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_API_URL: viteApiUrl,
    VITE_API_SECRET: apiSecret,
  },
});
console.log('Done. Output in client/dist/');
