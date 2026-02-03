/**
 * Shared .env file parsing and validation for deployment scripts.
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

export const SERVER_ENV_PATH = join(repoRoot, 'server', '.env');
export const SERVER_ENV_VARS = [
  'SALESFORCE_LOGIN_URL',
  'CLIENT_ID',
  'CLIENT_SECRET',
  'AGENTFORCE_AGENT_ID',
  'API_SECRET',
  'PORT',
];

/**
 * Parse a .env-style file into an object. Strips quotes from values.
 */
export function parseEnvFile(path) {
  if (!existsSync(path)) return null;
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

/**
 * Load and validate server/.env. Returns { env, errors }.
 */
export function loadServerEnv() {
  const errors = [];
  if (!existsSync(SERVER_ENV_PATH)) {
    errors.push(`server/.env not found at ${SERVER_ENV_PATH}`);
    return { env: {}, errors };
  }
  const env = parseEnvFile(SERVER_ENV_PATH);
  for (const key of SERVER_ENV_VARS) {
    const value = env[key];
    if (value == null || value === '') {
      errors.push(`Missing or empty in server/.env: ${key}`);
    }
  }
  return { env: env || {}, errors };
}
