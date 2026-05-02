#!/usr/bin/env node
/**
 * GitHub Push Script
 * Pushes the entire project to GitHub via the Contents API.
 * Works on empty repos. Run sequentially to respect rate limits.
 * Usage: node scripts/github-push.mjs [commit message]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const OWNER = 'JBlizzard-sketch';
const REPO = 'gawa-bill-splitter';
const ROOT = path.resolve(__dirname, '..');

if (!TOKEN) {
  console.error('❌ GITHUB_PERSONAL_ACCESS_TOKEN is not set');
  process.exit(1);
}

const COMMIT_MSG = process.argv[2] || `chore: sync — ${new Date().toISOString()}`;

const IGNORE_DIRS = new Set([
  '.git', 'node_modules', '.pnpm-store', 'dist', '.cache',
  '.local', 'tmp', '__pycache__', '.replit-artifact', 'build',
]);

const IGNORE_FILES = new Set(['pnpm-lock.yaml']);

const IGNORE_PATH_FRAGMENTS = [
  'lib/api-client-react/src/generated',
  'lib/api-zod/src/generated',
];

function shouldIgnore(fullPath) {
  const rel = fullPath.replace(ROOT + '/', '');
  const parts = rel.split('/');
  if (IGNORE_FILES.has(parts[parts.length - 1])) return true;
  if (IGNORE_PATH_FRAGMENTS.some(f => rel.includes(f))) return true;
  return parts.some(p => IGNORE_DIRS.has(p));
}

function walkDir(dir) {
  const results = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    const fp = path.join(dir, entry.name);
    if (shouldIgnore(fp)) continue;
    if (entry.isDirectory()) results.push(...walkDir(fp));
    else results.push(fp);
  }
  return results;
}

async function api(endpoint, method = 'GET', body = null) {
  const url = `https://api.github.com${endpoint}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${endpoint} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getFileSha(relPath) {
  try {
    const r = await api(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(relPath).replace(/%2F/g, '/')}`);
    return r.sha;
  } catch {
    return null;
  }
}

async function upsertFile(relPath, content64, message) {
  const sha = await getFileSha(relPath);
  const body = { message, content: content64, branch: 'main' };
  if (sha) body.sha = sha;
  return api(
    `/repos/${OWNER}/${REPO}/contents/${relPath.split('/').map(encodeURIComponent).join('/')}`,
    'PUT',
    body
  );
}

async function run() {
  console.log(`\n📦 Gawa → GitHub Push`);
  console.log(`   Repo: https://github.com/${OWNER}/${REPO}`);
  console.log(`   Commit: ${COMMIT_MSG}\n`);

  const files = walkDir(ROOT);
  console.log(`📂 Found ${files.length} files\n`);

  let done = 0;
  let failed = 0;

  for (const fp of files) {
    const relPath = fp.replace(ROOT + '/', '');
    try {
      const raw = fs.readFileSync(fp);
      const content64 = raw.toString('base64');
      await upsertFile(relPath, content64, COMMIT_MSG);
      done++;
      process.stdout.write(`\r   ✓ ${done}/${files.length} — ${relPath.slice(0, 60).padEnd(60)}`);
    } catch (e) {
      failed++;
      console.log(`\n   ✗ SKIP ${relPath}: ${e.message.slice(0, 120)}`);
    }
    // Small delay to respect secondary rate limits
    await sleep(80);
  }

  console.log(`\n\n✅ Done! ${done} files uploaded, ${failed} skipped.`);
  console.log(`   https://github.com/${OWNER}/${REPO}\n`);
}

run().catch((e) => {
  console.error('\n❌ Push failed:', e.message);
  process.exit(1);
});
