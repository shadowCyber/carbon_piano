#!/usr/bin/env node
// Parse-checks every JS/MJS file with `node --check` (no dependencies needed).

import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (/\.(m?js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = await walk(ROOT);
let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    console.error(`${path.relative(ROOT, file)}\n${err.stderr?.toString() ?? err.message}`);
  }
}
if (failed) process.exit(1);
console.log(`Syntax OK (${files.length} files).`);
