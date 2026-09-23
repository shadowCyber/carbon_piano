// Music theory primitives. Pure functions only: no DOM, no audio, no globals.
// Notes are represented as MIDI numbers (integers 0-127, middle C = 60).

export const MIDI_MIN = 0;
export const MIDI_MAX = 127;
export const MIDDLE_C = 60;

export const LETTERS = Object.freeze(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

const PITCH_CLASSES = Object.freeze([
  { letter: 'C', accidental: '' },
  { letter: 'C', accidental: '#' },
  { letter: 'D', accidental: '' },
  { letter: 'D', accidental: '#' },
  { letter: 'E', accidental: '' },
  { letter: 'F', accidental: '' },
  { letter: 'F', accidental: '#' },
  { letter: 'G', accidental: '' },
  { letter: 'G', accidental: '#' },
  { letter: 'A', accidental: '' },
  { letter: 'A', accidental: '#' },
  { letter: 'B', accidental: '' },
]);

const LETTER_TO_PC = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });

export function isMidi(value) {
  return Number.isInteger(value) && value >= MIDI_MIN && value <= MIDI_MAX;
}

export function assertMidi(value) {
  if (!isMidi(value)) {
    throw new RangeError(`Invalid MIDI note: ${String(value)}`);
  }
  return value;
}

export function pitchClass(midi) {
  return assertMidi(midi) % 12;
}

export function octaveOf(midi) {
  return Math.floor(assertMidi(midi) / 12) - 1;
}

export function isBlackKey(midi) {
  return PITCH_CLASSES[pitchClass(midi)].accidental !== '';
}

/** Human-facing description of a note, e.g. { name: 'C♯', label: 'C♯4' }. */
export function noteInfo(midi) {
  const pc = PITCH_CLASSES[pitchClass(midi)];
  const octave = octaveOf(midi);
  const name = pc.letter + (pc.accidental ? '♯' : '');
  return Object.freeze({
    midi,
    letter: pc.letter,
    accidental: pc.accidental,
    octave,
    name,
    label: `${name}${octave}`,
  });
}

/** Equal-temperament frequency in Hz (A4 = 440 Hz). */
export function frequency(midi) {
  return 440 * 2 ** ((assertMidi(midi) - 69) / 12);
}

const NOTE_RE = /^([A-G])([#b♯♭]?)(-1|[0-9])$/;

/** Parse scientific pitch notation ("C4", "F#3", "Bb2") into a MIDI number. */
export function parseNote(text) {
  if (typeof text !== 'string' || text.length > 4) {
    throw new TypeError(`Invalid note name: ${String(text)}`);
  }
  const match = NOTE_RE.exec(text);
  if (!match) {
    throw new TypeError(`Invalid note name: ${text}`);
  }
  const [, letter, acc, octaveText] = match;
  let offset = 0;
  if (acc === '#' || acc === '♯') offset = 1;
  if (acc === 'b' || acc === '♭') offset = -1;
  const midi = (Number(octaveText) + 1) * 12 + LETTER_TO_PC[letter] + offset;
  return assertMidi(midi);
}

/**
 * Position on the staff counted in letter steps (C0 = 0, D0 = 1, ...).
 * Sharps share the step of their natural (C♯4 sits on the C4 position).
 */
export function diatonicIndex(midi) {
  const { letter, octave } = noteInfo(midi);
  return octave * 7 + LETTERS.indexOf(letter);
}

/** Inclusive integer range of MIDI numbers. */
export function midiRange(low, high) {
  assertMidi(low);
  assertMidi(high);
  if (low > high) throw new RangeError('low must be <= high');
  return Array.from({ length: high - low + 1 }, (_, i) => low + i);
}

export function whiteKeysIn(low, high) {
  return midiRange(low, high).filter((m) => !isBlackKey(m));
}
