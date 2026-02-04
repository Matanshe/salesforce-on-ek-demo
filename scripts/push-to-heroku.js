#!/usr/bin/env node
/**
 * Builds the client for Heroku, moves it to server/public, commits, and pushes to Heroku.
 * Run from repo root: node scripts/push-to-heroku.js <heroku-app-name-or-url> [branch]
 *
 * Examples:
 *   node scripts/push-to-heroku.js my-app
 *   node scripts/push-to-heroku.js my-app main
 *   node scripts/push-to-heroku.js https://my-app.herokuapp.com
 *
 * Requires: Heroku CLI installed, logged in, and heroku remote configured (heroku git:remote -a my-app).
 */
import { execSync } from 'child_process';
import { rmSync, renameSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const clientDist = join(repoRoot, 'client', 'dist');
const serverPublic = join(repoRoot, 'server', 'public');

const args = process.argv.slice(2).filter((a) => a !== '--');
const appArg = args[0];
const branch = args[1] || 'main';

if (!appArg) {
  console.error('Usage: node scripts/push-to-heroku.js <heroku-app-name-or-url> [branch]');
  console.error('  branch defaults to "main". Use "master" if your default branch is master.');
  process.exit(1);
}

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: repoRoot, stdio: 'inherit', ...opts });
}

console.log('Step 1/4: Building client for Heroku...');
execSync('node', ['scripts/build-client-for-heroku.js', appArg], { cwd: repoRoot, stdio: 'inherit' });

if (!existsSync(clientDist)) {
  console.error('client/dist not found after build. Build may have failed or wrote to a different path.');
  process.exit(1);
}

console.log('Step 2/4: Moving build to server/public...');
if (existsSync(serverPublic)) rmSync(serverPublic, { recursive: true });
renameSync(clientDist, serverPublic);

console.log('Step 3/4: Staging and committing...');
run('git add server/public');
let hasStaged = false;
try {
  execSync('git diff --staged --quiet', { cwd: repoRoot });
} catch {
  hasStaged = true;
}
if (hasStaged) {
  run(`git commit -m "Deploy: build client for Heroku"`);
} else {
  console.log('Step 3/4: No changes to commit (server/public unchanged).');
}

console.log(`Step 4/4: Pushing to heroku ${branch}...`);
run(`git push heroku ${branch}`);

console.log('Done. Run "heroku open" to open your app.');
