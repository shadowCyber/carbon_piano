#!/usr/bin/env node
// Hardened zero-dependency static server for local development.
//
//  - Binds to 127.0.0.1 by default (not reachable from the LAN).
//  - Serves ONLY the public/ directory; path traversal, dotfiles, symlink escapes,
//    and unknown file types are refused.
//  - GET/HEAD only.
//  - Sends the same security headers as production (minus HSTS on plain HTTP).
//
// Usage: npm start            -> http://127.0.0.1:8080
//        PORT=3000 npm start
//        HOST=0.0.0.0 npm start  (opt-in: expose to your LAN, e.g. to test on a tablet)

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_HEADERS } from './security-headers.mjs';

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
});

const MAX_URL_LENGTH = 2048;

/** Map a request URL to an absolute file path inside root, or null if not allowed. */
export async function resolveSafePath(root, rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length > MAX_URL_LENGTH) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0') || pathname.includes('\\')) return null;
  if (pathname.endsWith('/')) pathname += 'index.html';

  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((seg) => seg.startsWith('.'))) return null; // dotfiles, "..", _headers etc. handled below

  const candidate = path.resolve(root, ...segments);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  if (!Object.hasOwn(MIME, path.extname(candidate).toLowerCase())) return null;

  try {
    // Resolve symlinks and re-check containment.
    const real = await realpath(candidate);
    if (!real.startsWith(root + path.sep)) return null;
    const info = await stat(real);
    return info.isFile() ? real : null;
  } catch {
    return null;
  }
}

export async function createAppServer({ root }) {
  const realRoot = await realpath(root);
  return createServer(async (req, res) => {
    for (const [name, value] of Object.entries(BASE_HEADERS)) res.setHeader(name, value);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    const file = await resolveSafePath(realRoot, req.url);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()],
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res);
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, '..', 'public');
  const host = process.env.HOST || '127.0.0.1';
  const port = Number.parseInt(process.env.PORT || '8080', 10);
  const server = await createAppServer({ root });
  server.listen(port, host, () => {
    console.log(`Carbon Piano running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    if (host === '0.0.0.0') console.warn('Warning: server is reachable from your local network.');
  });
}
