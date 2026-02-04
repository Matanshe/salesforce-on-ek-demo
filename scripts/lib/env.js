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
 * True when running on Heroku (env comes from Config Vars, not server/.env).
 * Uses DYNO (set by Heroku) or fallback: no .env file but all required vars in process.env.
 */
function detectHeroku() {
  if (typeof process.env.DYNO === 'string' && process.env.DYNO.length > 0) return true;
  if (!existsSync(SERVER_ENV_PATH)) {
    const allInEnv = SERVER_ENV_VARS.every((k) => process.env[k] != null && String(process.env[k]).trim() !== '');
    if (allInEnv) return true;
  }
  return false;
}

export const isHeroku = detectHeroku();

/**
 * Load and validate server env. On Heroku uses process.env; locally uses server/.env.
 * Returns { env, errors }.
 */
export function loadServerEnv() {
  const errors = [];
  const fromFile = existsSync(SERVER_ENV_PATH);
  const useProcessEnv =
    isHeroku ||
    (!fromFile && SERVER_ENV_VARS.every((k) => process.env[k] != null && String(process.env[k]).trim() !== ''));
  if (!fromFile && !useProcessEnv) {
    errors.push(`server/.env not found at ${SERVER_ENV_PATH}`);
    return { env: {}, errors };
  }
  const env = fromFile
    ? parseEnvFile(SERVER_ENV_PATH)
    : Object.fromEntries(SERVER_ENV_VARS.map((k) => [k, process.env[k]]));
  const source = fromFile ? 'server/.env' : 'process.env (Heroku Config Vars)';
  for (const key of SERVER_ENV_VARS) {
    const value = env[key];
    if (value == null || value === '') {
      errors.push(`Missing or empty in ${source}: ${key}`);
    }
  }
  return { env: env || {}, errors };
}
