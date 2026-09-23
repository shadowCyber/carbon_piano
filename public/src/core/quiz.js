// Note-recognition quiz engine.
//  - NAME mode:  "Find a D" -> any D on the keyboard is correct (octave-agnostic).
//  - STAFF mode: a note is drawn on the treble staff -> the exact pitch is required.

import { isMidi, midiRange, pitchClass, whiteKeysIn } from './music.js';

export const QUIZ_MODES = Object.freeze({ NAME: 'name', STAFF: 'staff' });

export const QUIZ_POOLS = Object.freeze({
  nameEasy: Object.freeze(whiteKeysIn(60, 71)),   // C4..B4 white keys
  nameAll: Object.freeze(midiRange(60, 71)),      // C4..B4 incl. sharps
  staffEasy: Object.freeze(whiteKeysIn(60, 72)),  // C4..C5
  staffHard: Object.freeze(whiteKeysIn(60, 81)),  // C4..A5
});

export class NoteQuiz {
  constructor({ mode, pool, rng = Math.random }) {
    if (!Object.values(QUIZ_MODES).includes(mode)) throw new TypeError('bad quiz mode');
    if (!Array.isArray(pool) || pool.length === 0 || !pool.every(isMidi)) {
      throw new TypeError('pool must be a non-empty array of MIDI notes');
    }
    if (typeof rng !== 'function') throw new TypeError('rng must be a function');
    this.mode = mode;
    this.pool = pool.slice();
    this.rng = rng;
    this.current = null;
    this.previous = null;
    this.score = 0;
    this.attempts = 0;
    this.streak = 0;
    this.bestStreak = 0;
  }

  #pick() {
    const r = this.rng();
    const idx = Math.min(this.pool.length - 1, Math.max(0, Math.floor(r * this.pool.length)));
    return this.pool[idx];
  }

  next() {
    let candidate = this.#pick();
    // Avoid asking the same thing twice in a row (bounded retries keep it deterministic-safe).
    for (let i = 0; i < 8 && this.pool.length > 1 && this.#same(candidate, this.previous); i += 1) {
      candidate = this.#pick();
    }
    this.current = candidate;
    return candidate;
  }

  #same(a, b) {
    if (a === null || b === null) return false;
    return this.mode === QUIZ_MODES.NAME ? pitchClass(a) === pitchClass(b) : a === b;
  }

  answer(midi) {
    if (this.current === null || !isMidi(midi)) return { result: 'ignored' };
    const target = this.current;
    const correct = this.mode === QUIZ_MODES.NAME
      ? pitchClass(midi) === pitchClass(target)
      : midi === target;
    this.attempts += 1;
    if (correct) {
      this.score += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.previous = target;
      this.current = null;
      return { result: 'correct', target, streak: this.streak };
    }
    this.streak = 0;
    return { result: 'wrong', target };
  }
}
