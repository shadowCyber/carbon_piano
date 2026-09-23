#!/usr/bin/env node
// Static security gate for the client bundle (public/). Runs in CI; exits non-zero on findings.
//
// Encodes project security invariants as machine-checked rules so they cannot
// silently regress (NIST SP 800-53 SA-11 / SA-15; OWASP ASVS V5 & V14):
//   1. No HTML-string DOM sinks or dynamic code execution.
//   2. No remote origins referenced from app code or markup (no third-party code/data).
//   3. No inline scripts, inline styles, or inline event handlers in HTML (CSP-compatible).
//   4. Web Storage access confined to the single validated adapter module.
//   5. The CSP in index.html <meta> and public/_headers match scripts/security-headers.mjs.
//   6. No runtime dependencies declared in package.json.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_HEADERS, CSP_META, PRODUCTION_ONLY_HEADERS } from './security-headers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

const JS_RULES = [
  { re: /\.(innerHTML|outerHTML)\s*=/, msg: 'HTML-string sink (innerHTML/outerHTML assignment)' },
  { re: /\binsertAdjacentHTML\s*\(/, msg: 'HTML-string sink (insertAdjacentHTML)' },
  { re: /\bdocument\.(write|writeln)\s*\(/, msg: 'document.write' },
  { re: /\bcreateContextualFragment\s*\(/, msg: 'HTML-string sink (createContextualFragment)' },
  { re: /\bDOMParser\b/, msg: 'DOMParser (HTML parsing of strings)' },
  { re: /(^|[^.\w])eval\s*\(/, msg: 'eval()' },
  { re: /\bnew\s+Function\s*\(/, msg: 'new Function()' },
  { re: /\bset(Timeout|Interval)\s*\(\s*['"`]/, msg: 'string passed to setTimeout/setInterval' },
  { re: /\bimport\s*\(\s*[^'"`]/, msg: 'dynamic import() with non-literal specifier' },
  { re: /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/, msg: 'network API in client code (app is offline-by-design)' },
  { re: /\bpostMessage\s*\(|addEventListener\(\s*['"]message['"]/, msg: 'cross-window messaging' },
  { re: /\.setAttribute\(\s*['"](on\w+|style|srcdoc|href|src)['"]/i, msg: 'dangerous attribute set via setAttribute' },
  { re: /\bjavascript:/i, msg: 'javascript: URL' },
];

const ALLOWED_URLS = new Set(['http://www.w3.org/2000/svg']);
const URL_RE = /\b(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s'"`)]*/gi;
const STORAGE_RE = /\b(localStorage|sessionStorage|indexedDB)\b/;
const STORAGE_ALLOWED = new Set(['src/ui/store.js']);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

function stripLineComments(line) {
  // Good enough for this codebase's style: ignore full-line and trailing // comments,
  // but not "//" inside URLs we then check separately.
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return '';
  return line;
}

const findings = [];
const report = (file, line, msg) => findings.push(`${path.relative(ROOT, file)}:${line}  ${msg}`);

function checkUrls(file, lineNo, text) {
  for (const match of text.matchAll(URL_RE)) {
    if (!ALLOWED_URLS.has(match[0])) report(file, lineNo, `remote URL referenced: ${match[0]}`);
  }
}

async function checkJs(file) {
  const rel = path.relative(PUBLIC, file).split(path.sep).join('/');
  const lines = (await readFile(file, 'utf8')).split('\n');
  lines.forEach((raw, i) => {
    const line = stripLineComments(raw);
    if (!line) return;
    for (const rule of JS_RULES) if (rule.re.test(line)) report(file, i + 1, rule.msg);
    if (STORAGE_RE.test(line) && !STORAGE_ALLOWED.has(rel)) {
      report(file, i + 1, 'Web Storage accessed outside src/ui/store.js');
    }
    checkUrls(file, i + 1, line);
  });
}

async function checkHtml(file) {
  const text = await readFile(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(line)) report(file, i + 1, 'inline <script>');
    if (/<style\b/i.test(line)) report(file, i + 1, 'inline <style>');
    if (/\sstyle\s*=/i.test(line)) report(file, i + 1, 'inline style attribute');
    if (/\son[a-z]+\s*=/i.test(line)) report(file, i + 1, 'inline event handler attribute');
    if (/<(iframe|object|embed|base)\b/i.test(line)) report(file, i + 1, 'disallowed element');
    checkUrls(file, i + 1, line);
  });

  if (path.basename(file) === 'index.html') {
    const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(text);
    if (!meta) report(file, 1, 'missing CSP <meta>');
    else if (meta[1] !== CSP_META) report(file, 1, 'CSP <meta> drifted from scripts/security-headers.mjs');
    if (!/<script type="module" src="src\/app\.js"><\/script>/.test(text)) {
      report(file, 1, 'expected single module entrypoint src/app.js');
    }
  }
}

async function checkHeadersFile() {
  const file = path.join(PUBLIC, '_headers');
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    report(file, 1, 'missing public/_headers');
    return;
  }
  const expected = { ...BASE_HEADERS, ...PRODUCTION_ONLY_HEADERS };
  for (const [name, value] of Object.entries(expected)) {
    if (!text.includes(`  ${name}: ${value}\n`)) report(file, 1, `header missing or drifted: ${name}`);
  }
}

async function checkPackage() {
  const file = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(await readFile(file, 'utf8'));
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies', 'bundledDependencies']) {
    if (pkg[field] && Object.keys(pkg[field]).length > 0) {
      report(file, 1, `${field} declared — runtime dependencies require a security review (see SECURITY.md)`);
    }
  }
  for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
    if (/^(pre|post)?install$/.test(name)) report(file, 1, `lifecycle script "${name}" is not allowed: ${cmd}`);
  }
}

const files = await walk(PUBLIC);
for (const file of files) {
  if (file.endsWith('.js')) await checkJs(file);
  else if (file.endsWith('.html')) await checkHtml(file);
}
await checkHeadersFile();
await checkPackage();

if (findings.length) {
  console.error(`Security check FAILED with ${findings.length} finding(s):\n`);
  for (const f of findings) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`Security check passed (${files.length} files scanned).`);
