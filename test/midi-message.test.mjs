import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMidiMessage } from '../public/src/core/midi-message.js';

test('parses note on/off on any channel', () => {
  assert.deepEqual(parseMidiMessage(new Uint8Array([0x90, 60, 127])), { type: 'noteOn', note: 60, velocity: 1 });
  assert.deepEqual(parseMidiMessage([0x9f, 61, 64]), { type: 'noteOn', note: 61, velocity: 64 / 127 });
  assert.deepEqual(parseMidiMessage([0x80, 60, 0]), { type: 'noteOff', note: 60 });
  assert.deepEqual(parseMidiMessage([0x90, 60, 0]), { type: 'noteOff', note: 60 }, 'running-status style note off');
});

test('all-notes-off controllers', () => {
  assert.deepEqual(parseMidiMessage([0xb0, 123, 0]), { type: 'allOff' });
  assert.deepEqual(parseMidiMessage([0xb3, 120, 0]), { type: 'allOff' });
  assert.equal(parseMidiMessage([0xb0, 7, 100]), null, 'volume CC ignored');
});

test('drops malformed, sysex, and unexpected messages', () => {
  const bad = [
    null, undefined, {}, [], [0x90], [0x90, 60, 127, 1],
    [0xf0, 0x7e, 0x7f], [0xf8, 0, 0], [0x40, 60, 100],
    [0x90, 128, 100], [0x90, 60, 200], [0x90, -1, 10], [0x90, 60.5, 10], ['0x90', 60, 10],
  ];
  for (const msg of bad) assert.equal(parseMidiMessage(msg), null, JSON.stringify(msg));
});
