// Built-in song library. All melodies are traditional / public domain.
// Songs are static, frozen data compiled into the app; nothing is fetched at runtime.
//
// Notation: space-separated tokens "NOTE[:BEATS]", e.g. "C4 D4:2 R:1".
// "R" is a rest. BEATS defaults to 1 (a quarter note).

import { parseNote } from './music.js';

const MAX_TOKENS = 512;
const TOKEN_RE = /^(R|[A-G][#b]?-?\d)(?::(\d+(?:\.\d+)?))?$/;

export function parseMelody(text) {
  if (typeof text !== 'string') throw new TypeError('melody must be a string');
  const tokens = text.trim().split(/\s+/);
  if (tokens.length > MAX_TOKENS) throw new RangeError('melody too long');
  return Object.freeze(
    tokens.map((token) => {
      const match = TOKEN_RE.exec(token);
      if (!match) throw new TypeError(`Bad melody token: ${token}`);
      const beats = match[2] === undefined ? 1 : Number(match[2]);
      if (!(beats > 0 && beats <= 16)) throw new RangeError(`Bad duration: ${token}`);
      const midi = match[1] === 'R' ? null : parseNote(match[1]);
      return Object.freeze({ midi, beats });
    }),
  );
}

function song(id, title, level, bpm, melody) {
  return Object.freeze({ id, title, level, bpm, notes: parseMelody(melody) });
}

export const SONGS = Object.freeze([
  song('hot-cross-buns', 'Hot Cross Buns', 1, 100,
    'E4 D4 C4:2 E4 D4 C4:2 C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5 E4 D4 C4:2'),
  song('mary-had-a-little-lamb', 'Mary Had a Little Lamb', 1, 110,
    'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4'),
  song('twinkle-twinkle', 'Twinkle, Twinkle, Little Star', 2, 100,
    'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 ' +
    'G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 ' +
    'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2'),
  song('row-your-boat', 'Row, Row, Row Your Boat', 2, 100,
    'C4:1.5 C4:1.5 C4 D4:0.5 E4:1.5 E4 D4:0.5 E4 F4:0.5 G4:3 ' +
    'C5:0.5 C5:0.5 C5:0.5 G4:0.5 G4:0.5 G4:0.5 E4:0.5 E4:0.5 E4:0.5 C4:0.5 C4:0.5 C4:0.5 ' +
    'G4 F4:0.5 E4 D4:0.5 C4:3'),
  song('ode-to-joy', 'Ode to Joy', 3, 108,
    'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2 ' +
    'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2'),
  song('jingle-bells', 'Jingle Bells', 3, 120,
    'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4 ' +
    'F4 F4 F4:1.5 F4:0.5 F4 E4 E4 E4:0.5 E4:0.5 E4 D4 D4 E4 D4:2 G4:2'),
  song('happy-birthday', 'Happy Birthday', 4, 100,
    'G4:0.75 G4:0.25 A4 G4 C5 B4:2 G4:0.75 G4:0.25 A4 G4 D5 C5:2 ' +
    'G4:0.75 G4:0.25 G5 E5 C5 B4 A4:2 F5:0.75 F5:0.25 E5 C5 D5 C5:2'),
]);

export const SONG_IDS = Object.freeze(SONGS.map((s) => s.id));

export function getSong(id) {
  return SONGS.find((s) => s.id === id) ?? null;
}
