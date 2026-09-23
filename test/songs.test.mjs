import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, SONG_IDS, getSong, parseMelody } from '../public/src/core/songs.js';

test('song library is well formed and playable on the C4..C6 keyboard', () => {
  assert.ok(SONGS.length >= 5);
  assert.equal(new Set(SONG_IDS).size, SONG_IDS.length, 'ids unique');
  for (const song of SONGS) {
    assert.match(song.id, /^[a-z0-9-]+$/);
    assert.ok(Object.isFrozen(song) && Object.isFrozen(song.notes));
    assert.ok(song.level >= 1 && song.level <= 5);
    for (const n of song.notes) {
      if (n.midi !== null) assert.ok(n.midi >= 60 && n.midi <= 84, `${song.id} note ${n.midi} in range`);
      assert.ok(n.beats > 0);
    }
  }
});

test('parseMelody parses durations and rests', () => {
  assert.deepEqual(parseMelody('C4 D4:2 R:0.5'), [
    { midi: 60, beats: 1 }, { midi: 62, beats: 2 }, { midi: null, beats: 0.5 },
  ]);
});

test('parseMelody rejects bad tokens and oversized input', () => {
  assert.throws(() => parseMelody('C4 X9'));
  assert.throws(() => parseMelody('C4:0'));
  assert.throws(() => parseMelody('C4:99'));
  assert.throws(() => parseMelody(Array(600).fill('C4').join(' ')), RangeError);
});

test('getSong', () => {
  assert.equal(getSong('ode-to-joy').title, 'Ode to Joy');
  assert.equal(getSong('nope'), null);
  assert.equal(getSong('__proto__'), null);
});
