#!/usr/bin/env node
/**
 * Validates that server/.env exists and has all required vars for Heroku deployment.
 * Run from repo root: node scripts/validate-env.js
 */
import { loadServerEnv, SERVER_ENV_PATH } from './lib/env.js';

const { env, errors } = loadServerEnv();

if (errors.length > 0) {
  console.error('Validation failed:\n');
  errors.forEach((e) => console.error('  -', e));
  console.error('\nCopy server/.env.example to server/.env and fill in values.');
  process.exit(1);
}

console.log('server/.env found with required vars:');
console.log('  SALESFORCE_LOGIN_URL:', env.SALESFORCE_LOGIN_URL ? '(set)' : '(missing)');
console.log('  CLIENT_ID:', env.CLIENT_ID ? '(set)' : '(missing)');
console.log('  CLIENT_SECRET:', env.CLIENT_SECRET ? '(set)' : '(missing)');
console.log('  AGENTFORCE_AGENT_ID:', env.AGENTFORCE_AGENT_ID ? '(set)' : '(missing)');
console.log('  API_SECRET:', env.API_SECRET ? '(set)' : '(missing)');
console.log('  PORT:', env.PORT ? `(set: ${env.PORT})` : '(missing)');
console.log('\nOK. server/.env is valid for set-heroku-config and build-client-for-heroku.');
