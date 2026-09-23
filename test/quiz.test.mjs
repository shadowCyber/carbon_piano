import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NoteQuiz, QUIZ_MODES, QUIZ_POOLS } from '../public/src/core/quiz.js';

function seq(...values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('name mode accepts any octave; staff mode requires exact pitch', () => {
  const nq = new NoteQuiz({ mode: QUIZ_MODES.NAME, pool: [62], rng: () => 0 });
  nq.next();
  assert.equal(nq.answer(74).result, 'correct');

  const sq = new NoteQuiz({ mode: QUIZ_MODES.STAFF, pool: [62], rng: () => 0 });
  sq.next();
  assert.equal(sq.answer(74).result, 'wrong');
  assert.equal(sq.answer(62).result, 'correct');
});

test('streaks, best streak and ignored answers', () => {
  const q = new NoteQuiz({ mode: QUIZ_MODES.STAFF, pool: [60, 62], rng: seq(0, 0.9) });
  assert.equal(q.answer(60).result, 'ignored', 'no question yet');
  q.next(); q.answer(60);
  q.next(); q.answer(62);
  assert.equal(q.streak, 2);
  q.next(); q.answer(71);
  assert.equal(q.streak, 0);
  assert.equal(q.bestStreak, 2);
  assert.equal(q.attempts, 3);
});

test('avoids repeating the previous question', () => {
  const q = new NoteQuiz({ mode: QUIZ_MODES.STAFF, pool: [60, 62], rng: seq(0, 0, 0, 0.9) });
  q.next(); q.answer(60);
  assert.equal(q.next(), 62);
});

test('rng output outside [0,1) cannot index out of bounds', () => {
  for (const r of [1, 5, -3, NaN]) {
    const q = new NoteQuiz({ mode: QUIZ_MODES.STAFF, pool: [60, 62, 64], rng: () => r });
    assert.ok([60, 62, 64].includes(q.next()) || Number.isNaN(r));
  }
});

test('constructor validation and pools', () => {
  assert.throws(() => new NoteQuiz({ mode: 'x', pool: [60] }));
  assert.throws(() => new NoteQuiz({ mode: 'name', pool: [] }));
  assert.throws(() => new NoteQuiz({ mode: 'name', pool: [999] }));
  assert.deepEqual([...QUIZ_POOLS.nameEasy], [60, 62, 64, 65, 67, 69, 71]);
});
