import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ECHO_MAX_LENGTH, EchoGame } from '../public/src/core/echo.js';

test('echo game grows the sequence and tracks lives', () => {
  const g = new EchoGame({ pool: [60, 62], rng: () => 0, lives: 2 });
  assert.equal(g.press(60).result, 'ignored', 'idle');
  assert.deepEqual(g.start(), [60]);
  assert.equal(g.press(60).result, 'ignored', 'input not open during listen phase');
  g.beginInput();
  assert.deepEqual(g.press(60), { result: 'levelUp', level: 1 });
  assert.deepEqual(g.sequence, [60, 60]);
  g.beginInput();
  assert.equal(g.press(60).result, 'correct');
  assert.deepEqual(g.press(62), { result: 'retry', expected: 60, lives: 1 });
  g.beginInput();
  assert.deepEqual(g.press(62), { result: 'gameOver', expected: 60, level: 1 });
  assert.equal(g.phase, 'over');
});

test('echo game ends with a win at the maximum length', () => {
  const g = new EchoGame({ pool: [60], rng: () => 0 });
  g.start();
  let last;
  for (let round = 0; round < ECHO_MAX_LENGTH; round += 1) {
    g.beginInput();
    for (let i = 0; i < g.sequence.length; i += 1) last = g.press(60);
  }
  assert.equal(last.result, 'won');
  assert.equal(g.sequence.length, ECHO_MAX_LENGTH);
});

test('echo validation', () => {
  assert.throws(() => new EchoGame({ pool: [] }));
  assert.throws(() => new EchoGame({ pool: [60], lives: 0 }));
});
