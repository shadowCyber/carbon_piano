import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { request } from 'node:http';
import { createAppServer, resolveSafePath } from '../scripts/serve.mjs';
import { BASE_HEADERS } from '../scripts/security-headers.mjs';

let dir;
let root;
let server;
let port;

before(async () => {
  dir = await realpath(await mkdtemp(path.join(tmpdir(), 'cp-')));
  root = path.join(dir, 'public');
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  await writeFile(path.join(root, 'src', 'app.js'), 'export {};');
  await writeFile(path.join(root, '_headers'), 'secret-ish');
  await writeFile(path.join(root, '.env'), 'SECRET=1');
  await writeFile(path.join(root, 'notes.txt'), 'x');
  await writeFile(path.join(dir, 'outside.js'), 'leak');
  await symlink(path.join(dir, 'outside.js'), path.join(root, 'link.js'));
  server = await createAppServer({ root });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await rm(dir, { recursive: true, force: true });
});

function get(pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: pathname, method }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves allowed files with security headers and correct MIME', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  for (const [name, value] of Object.entries(BASE_HEADERS)) {
    assert.equal(res.headers[name.toLowerCase()], value, name);
  }
  const js = await get('/src/app.js');
  assert.match(js.headers['content-type'], /text\/javascript/);
});

test('refuses traversal, dotfiles, unknown types, symlink escapes', async () => {
  for (const p of [
    '/../outside.js', '/%2e%2e/outside.js', '/src/%2e%2e/%2e%2e/outside.js', '/..%2Foutside.js',
    '/.env', '/_headers', '/notes.txt', '/link.js', '/src%00.js', '/%5c..%5coutside.js', '/%E0%A4%A',
  ]) {
    const res = await get(p);
    assert.equal(res.status, 404, p);
    assert.doesNotMatch(res.body, /leak|SECRET/, p);
  }
});

test('only GET and HEAD are allowed', async () => {
  assert.equal((await get('/', 'POST')).status, 405);
  assert.equal((await get('/', 'PUT')).status, 405);
  const head = await get('/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});

test('resolveSafePath rejects oversized URLs', async () => {
  assert.equal(await resolveSafePath(root, '/' + 'a'.repeat(5000) + '.js'), null);
});
