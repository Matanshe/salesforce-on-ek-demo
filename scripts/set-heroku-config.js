#!/usr/bin/env node
/**
 * Sets Heroku config vars from server/.env.
 * Run from repo root: node scripts/set-heroku-config.js
 * Requires: Heroku CLI installed and logged in.
 */
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadServerEnv, SERVER_ENV_VARS } from './lib/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const { env, errors } = loadServerEnv();
if (errors.length > 0) {
  console.error('Cannot set Heroku config: server/.env validation failed:');
  errors.forEach((e) => console.error('  -', e));
  console.error('\nRun: node scripts/validate-env.js');
  process.exit(1);
}

for (const key of SERVER_ENV_VARS) {
  const value = env[key];
  if (value == null || value === '') {
    console.warn(`Skipping ${key}: not set in server/.env`);
    continue;
  }
  const arg = `${key}=${value}`;
  console.log(`Setting ${key}...`);
  execSync('heroku', ['config:set', arg], { stdio: 'inherit', cwd: repoRoot });
}

// Required for client build during Heroku "npm start" (Vite production build)
if (env.API_SECRET) {
  console.log('Setting VITE_API_SECRET (same as API_SECRET for client build)...');
  execSync(`heroku config:set VITE_API_SECRET=${env.API_SECRET}`, { stdio: 'inherit', cwd: repoRoot });
}
try {
  const info = execSync('heroku apps:info --json', { encoding: 'utf8', cwd: repoRoot });
  const { app } = JSON.parse(info);
  if (app && app.name) {
    const viteApiUrl = `https://${app.name}.herokuapp.com`;
    console.log('Setting VITE_API_URL for client build...');
    execSync(`heroku config:set VITE_API_URL=${viteApiUrl}`, { stdio: 'inherit', cwd: repoRoot });
  }
} catch (e) {
  console.warn('Could not set VITE_API_URL (run from a Heroku-linked repo or pass -a <app>). Set it manually: heroku config:set VITE_API_URL=https://<your-app>.herokuapp.com');
}

console.log('Done. Heroku config set from server/.env');
