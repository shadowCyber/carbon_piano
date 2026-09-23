import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STORED_CHARS, defaultProgress, parseProgress, sanitizeProgress, serializeProgress,
  withEchoBest, withQuizBest, withSettings, withSongResult,
} from '../public/src/core/progress.js';

const IDS = ['a', 'b'];

test('round-trips valid progress', () => {
  let p = defaultProgress();
  p = withSongResult(p, 'a', 2);
  p = withQuizBest(p, 'staff', 7);
  p = withEchoBest(p, 4);
  p = withSettings(p, { volume: 0.3, showNames: false });
  assert.deepEqual(parseProgress(serializeProgress(p, IDS), IDS), p);
});

test('garbage, oversized, and wrong-version input fall back to defaults', () => {
  for (const text of [null, '', 'not json', '[]', '42', '"x"', 'null', '{"version":2}', 'x'.repeat(MAX_STORED_CHARS + 1)]) {
    assert.deepEqual(parseProgress(text, IDS), defaultProgress(), String(text).slice(0, 20));
  }
});

test('prototype pollution payloads are inert', () => {
  const payload = '{"version":1,"__proto__":{"polluted":true},"songs":{"__proto__":{"stars":3},"constructor":{"stars":3},"a":{"stars":3,"plays":1}},"settings":{"__proto__":{"volume":1}}}';
  const p = parseProgress(payload, IDS);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
  assert.deepEqual(Object.keys(p.songs), ['a']);
  assert.equal(Object.getPrototypeOf(p), Object.prototype);
  assert.equal(p.settings.volume, defaultProgress().settings.volume);
});

test('unknown songs dropped; types enforced; values clamped', () => {
  const p = sanitizeProgress({
    version: 1,
    settings: { showNames: 'yes', colorKeys: false, volume: 5, extra: '<script>' },
    songs: { a: { stars: 99, plays: -4 }, b: { stars: '3' }, evil: { stars: 3 } },
    quiz: { name: 1e9, staff: 2.5 },
    echo: { best: -1 },
    injected: 'x',
  }, IDS);
  assert.deepEqual(p, {
    version: 1,
    settings: { showNames: true, colorKeys: false, showShortcuts: false, volume: 1 },
    songs: { a: { stars: 3, plays: 0 } },
    quiz: { name: 9999, staff: 0 },
    echo: { best: 0 },
  });
});

test('song results keep the best stars and count plays', () => {
  let p = withSongResult(defaultProgress(), 'a', 3);
  p = withSongResult(p, 'a', 1);
  assert.deepEqual(p.songs.a, { stars: 3, plays: 2 });
});

test('quiz best ignores unknown modes', () => {
  const p = defaultProgress();
  assert.equal(withQuizBest(p, '__proto__', 5), p);
});

test('settings patches are sanitized', () => {
  const p = withSettings(defaultProgress(), { volume: 'loud', showNames: 1 });
  assert.equal(p.settings.volume, 0.7);
  assert.equal(p.settings.showNames, true);
});
