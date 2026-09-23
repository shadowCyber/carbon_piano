// "Echo" memory / ear-training game (Simon-style).
// The app plays a sequence, the student repeats it; each round adds one note.
// Phases: 'idle' -> 'listen' (app playing) -> 'input' (student) -> 'listen' ... -> 'over'

import { isMidi } from './music.js';

export const ECHO_MAX_LENGTH = 32;

export class EchoGame {
  constructor({ pool, rng = Math.random, lives = 3 }) {
    if (!Array.isArray(pool) || pool.length === 0 || !pool.every(isMidi)) {
      throw new TypeError('pool must be a non-empty array of MIDI notes');
    }
    if (!Number.isInteger(lives) || lives < 1 || lives > 9) throw new RangeError('bad lives');
    this.pool = pool.slice();
    this.rng = rng;
    this.maxLives = lives;
    this.phase = 'idle';
    this.sequence = [];
    this.lives = lives;
    this.pos = 0;
  }

  #random() {
    const idx = Math.min(this.pool.length - 1, Math.max(0, Math.floor(this.rng() * this.pool.length)));
    return this.pool[idx];
  }

  /** Completed rounds. */
  get level() {
    return Math.max(0, this.sequence.length - 1);
  }

  start() {
    this.sequence = [this.#random()];
    this.lives = this.maxLives;
    this.pos = 0;
    this.phase = 'listen';
    return this.sequence.slice();
  }

  beginInput() {
    if (this.phase !== 'listen') return false;
    this.phase = 'input';
    this.pos = 0;
    return true;
  }

  press(midi) {
    if (this.phase !== 'input' || !isMidi(midi)) return { result: 'ignored' };
    if (midi === this.sequence[this.pos]) {
      this.pos += 1;
      if (this.pos < this.sequence.length) return { result: 'correct' };
      if (this.sequence.length >= ECHO_MAX_LENGTH) {
        this.phase = 'over';
        return { result: 'won', level: this.sequence.length };
      }
      this.sequence.push(this.#random());
      this.phase = 'listen';
      return { result: 'levelUp', level: this.level };
    }
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'over';
      return { result: 'gameOver', expected: this.sequence[this.pos], level: this.level };
    }
    this.phase = 'listen';
    return { result: 'retry', expected: this.sequence[this.pos], lives: this.lives };
  }
}
