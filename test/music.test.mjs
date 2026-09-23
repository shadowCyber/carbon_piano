import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertMidi, diatonicIndex, frequency, isBlackKey, midiRange, noteInfo, parseNote, whiteKeysIn,
} from '../public/src/core/music.js';

test('parseNote handles naturals, sharps, flats', () => {
  assert.equal(parseNote('C4'), 60);
  assert.equal(parseNote('A4'), 69);
  assert.equal(parseNote('F#3'), 54);
  assert.equal(parseNote('Bb2'), 46);
  assert.equal(parseNote('C-1'), 0);
  assert.equal(parseNote('G9'), 127);
});

test('parseNote rejects malformed and out-of-range input', () => {
  for (const bad of ['', 'H4', 'C', 'C10', 'c4', 'C#', 'C4 ', null, 60, 'G#9', 'Cb-1', '__proto__']) {
    assert.throws(() => parseNote(bad), `${String(bad)} should throw`);
  }
});

test('assertMidi enforces integer 0..127', () => {
  for (const bad of [-1, 128, 1.5, NaN, '60', null, undefined, Infinity]) {
    assert.throws(() => assertMidi(bad), RangeError);
  }
  assert.equal(assertMidi(0), 0);
  assert.equal(assertMidi(127), 127);
});

test('noteInfo and black keys', () => {
  assert.deepEqual({ ...noteInfo(60) }, { midi: 60, letter: 'C', accidental: '', octave: 4, name: 'C', label: 'C4' });
  assert.equal(noteInfo(61).label, 'C♯4');
  assert.deepEqual(midiRange(60, 71).filter(isBlackKey), [61, 63, 66, 68, 70]);
  assert.deepEqual(whiteKeysIn(60, 72), [60, 62, 64, 65, 67, 69, 71, 72]);
});

test('frequency is equal-tempered around A440', () => {
  assert.equal(frequency(69), 440);
  assert.ok(Math.abs(frequency(60) - 261.6256) < 1e-3);
  assert.equal(frequency(81), 880);
});

test('diatonicIndex steps by letter', () => {
  assert.equal(diatonicIndex(62) - diatonicIndex(60), 1);
  assert.equal(diatonicIndex(72) - diatonicIndex(60), 7);
  assert.equal(diatonicIndex(61), diatonicIndex(60));
});
