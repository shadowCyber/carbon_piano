import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lesson, starsFor } from '../public/src/core/lesson.js';
import { parseMelody } from '../public/src/core/songs.js';

const song = { id: 't', title: 'T', bpm: 100, notes: parseMelody('C4 R D4 E4') };

test('lesson advances only on the correct note and skips rests', () => {
  const l = new Lesson(song);
  assert.equal(l.expected, 60);
  assert.deepEqual(l.press(62), { result: 'wrong', expected: 60 });
  assert.equal(l.press(60).result, 'correct');
  assert.equal(l.expected, 62);
  l.press(62);
  assert.deepEqual(l.press(64), { result: 'correct', done: true });
  assert.equal(l.done, true);
  assert.equal(l.expected, null);
  assert.equal(l.press(60).result, 'ignored');
  assert.equal(l.mistakes, 1);
});

test('lesson ignores invalid input without counting a mistake', () => {
  const l = new Lesson(song);
  for (const bad of [-1, 200, 1.2, '60', null]) assert.equal(l.press(bad).result, 'ignored');
  assert.equal(l.mistakes, 0);
});

test('stars scale with accuracy', () => {
  assert.equal(starsFor(0, 20), 3);
  assert.equal(starsFor(1, 20), 3);
  assert.equal(starsFor(4, 20), 2);
  assert.equal(starsFor(10, 20), 1);
  assert.equal(starsFor(0, 0), 0);
  const l = new Lesson(song);
  assert.equal(l.stars(), 0, 'no stars before finishing');
});
