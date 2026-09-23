// "Follow along" lesson engine: the student must press each note of a song in order.
// Pure state machine; the UI decides how to render hints and feedback.

import { isMidi } from './music.js';

export function starsFor(mistakes, total) {
  if (!Number.isInteger(total) || total <= 0) return 0;
  const ratio = Math.max(0, mistakes) / total;
  if (ratio <= 0.05) return 3;
  if (ratio <= 0.2) return 2;
  return 1;
}

export class Lesson {
  constructor(song) {
    if (!song || !Array.isArray(song.notes)) throw new TypeError('song required');
    this.song = song;
    this.notes = song.notes.filter((n) => n.midi !== null);
    if (this.notes.length === 0) throw new RangeError('song has no notes');
    this.reset();
  }

  reset() {
    this.index = 0;
    this.mistakes = 0;
  }

  get done() {
    return this.index >= this.notes.length;
  }

  get expected() {
    return this.done ? null : this.notes[this.index].midi;
  }

  get progress() {
    return this.index / this.notes.length;
  }

  /** @returns {{result: 'correct'|'wrong'|'ignored', done?: boolean, expected?: number}} */
  press(midi) {
    if (this.done || !isMidi(midi)) return { result: 'ignored' };
    const expected = this.expected;
    if (midi === expected) {
      this.index += 1;
      return { result: 'correct', done: this.done };
    }
    this.mistakes += 1;
    return { result: 'wrong', expected };
  }

  stars() {
    return this.done ? starsFor(this.mistakes, this.notes.length) : 0;
  }
}
