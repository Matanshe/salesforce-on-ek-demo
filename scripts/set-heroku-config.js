#!/usr/bin/env node
/**
 * Sets Heroku config vars from server/.env.
 * Run from repo root: node scripts/set-heroku-config.js
 * Requires: Heroku CLI installed and logged in.
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const envPath = join(repoRoot, 'server', '.env');

const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
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

const vars = [
  'SALESFORCE_LOGIN_URL',
  'CLIENT_ID',
  'CLIENT_SECRET',
  'AGENTFORCE_AGENT_ID',
  'API_SECRET',
  'PORT',
];

for (const key of vars) {
  const value = env[key];
  if (value == null || value === '') {
    console.warn(`Skipping ${key}: not set in server/.env`);
    continue;
  }
  const arg = `${key}=${value}`;
  console.log(`Setting ${key}...`);
  execSync('heroku', ['config:set', arg], { stdio: 'inherit' });
}

console.log('Done. Heroku config set from server/.env');
