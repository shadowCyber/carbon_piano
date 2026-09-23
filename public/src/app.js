// Carbon Piano bootstrap: wires input sources -> synth + keyboard + active mode.

import { SONG_IDS } from './core/songs.js';
import { withSettings } from './core/progress.js';
import { Synth } from './ui/audio.js';
import { h } from './ui/dom.js';
import { PianoKeyboard } from './ui/keyboard.js';
import { connectMidi, midiSupported } from './ui/midi-input.js';
import { playMelody } from './ui/player.js';
import { ProgressStore } from './ui/store.js';
import { createFreePlay } from './modes/freeplay.js';
import { createSongs } from './modes/songs.js';
import { createQuiz } from './modes/quiz.js';
import { createEcho } from './modes/echo.js';
import { createProgress } from './modes/progress.js';

const KEYBOARD_LOW = 60;   // C4 (middle C)
const KEYBOARD_HIGH = 84;  // C6

const $ = (id) => document.getElementById(id);

const store = new ProgressStore(SONG_IDS);
const synth = new Synth();
const statusEl = $('status');
let activeMode = null;
let statusTimer = null;

function say(message, tone = 'info') {
  clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
  statusTimer = setTimeout(() => { statusEl.dataset.tone = 'info'; }, 1500);
}

// ---- note routing ---------------------------------------------------------
function userNoteOn(midi, velocity = 0.8) {
  synth.noteOn(midi, velocity);
  keyboard.setPressed(midi, true);
  activeMode?.onNoteOn(midi);
}

function userNoteOff(midi) {
  synth.noteOff(midi);
  keyboard.setPressed(midi, false);
}

function allOff() {
  keyboard.releaseAll();
  synth.allOff();
  keyboard.clearPressed();
}

const keyboard = new PianoKeyboard($('keyboard'), {
  low: KEYBOARD_LOW,
  high: KEYBOARD_HIGH,
  onNoteOn: userNoteOn,
  onNoteOff: userNoteOff,
});

// Demo playback sounds + lights keys but never counts as the student's answer.
let cancelDemo = null;
const demo = {
  play(notes, bpm, { onDone } = {}) {
    demo.stop();
    synth.unlock();
    cancelDemo = playMelody(notes, {
      bpm,
      onNoteStart: (midi) => { synth.noteOn(midi, 0.7); keyboard.setPressed(midi, true); },
      onNoteEnd: (midi) => { synth.noteOff(midi); keyboard.setPressed(midi, false); },
      onDone: () => { cancelDemo = null; onDone?.(); },
    });
  },
  stop() {
    cancelDemo?.();
    cancelDemo = null;
  },
};

function playNote(midi) {
  demo.play([{ midi, beats: 1 }], 90);
}

// ---- settings -------------------------------------------------------------
const body = document.body;
function applySettings() {
  const { showNames, colorKeys, showShortcuts, volume } = store.state.settings;
  body.classList.toggle('hide-names', !showNames);
  body.classList.toggle('no-color', !colorKeys);
  body.classList.toggle('show-shortcuts', showShortcuts);
  synth.setVolume(volume);
  $('opt-names').checked = showNames;
  $('opt-color').checked = colorKeys;
  $('opt-shortcuts').checked = showShortcuts;
  $('opt-volume').value = String(Math.round(volume * 100));
}

function bindSetting(id, key, read = (el) => el.checked) {
  $(id).addEventListener('input', (e) => {
    store.update((p) => withSettings(p, { [key]: read(e.target) }));
    applySettings();
  });
}
bindSetting('opt-names', 'showNames');
bindSetting('opt-color', 'colorKeys');
bindSetting('opt-shortcuts', 'showShortcuts');
bindSetting('opt-volume', 'volume', (el) => Number(el.value) / 100);

// ---- MIDI -----------------------------------------------------------------
const midiBtn = $('midi-connect');
const midiStatus = $('midi-status');
if (!midiSupported()) {
  midiBtn.disabled = true;
  midiStatus.textContent = 'Not supported in this browser.';
}
midiBtn.addEventListener('click', async () => {
  synth.unlock();
  try {
    await connectMidi({
      onNoteOn: (note, velocity) => userNoteOn(note, velocity),
      onNoteOff: (note) => userNoteOff(note),
      onAllOff: allOff,
      onDevicesChanged: (names) => {
        midiStatus.textContent = names.length ? `Connected: ${names.join(', ')}` : 'No keyboard found — plug one in.';
      },
    });
    midiBtn.disabled = true;
  } catch (err) {
    midiStatus.textContent = err?.name === 'SecurityError' || err?.name === 'NotAllowedError'
      ? 'Permission was not granted.'
      : 'Could not connect to MIDI.';
  }
});

// ---- modes ----------------------------------------------------------------
const ctx = { keyboard, synth, store, say, demo, playNote, applySettings };
const modes = [createFreePlay(ctx), createSongs(ctx), createQuiz(ctx), createEcho(ctx), createProgress(ctx)];
const tabs = $('tabs');
const stage = $('stage');

function activate(mode) {
  if (activeMode === mode) return;
  activeMode?.exit();
  demo.stop();
  allOff();
  activeMode = mode;
  for (const tab of tabs.children) {
    const selected = tab.dataset.mode === mode.id;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  stage.replaceChildren(mode.root);
  mode.enter();
  statusEl.textContent = '';
}

for (const mode of modes) {
  tabs.append(h('button', {
    class: 'tab',
    text: mode.label,
    dataset: { mode: mode.id },
    attrs: { type: 'button', role: 'tab', 'aria-controls': 'stage', 'aria-selected': 'false' },
    on: { click: () => activate(mode) },
  }));
}
tabs.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const i = modes.indexOf(activeMode);
  const next = modes[(i + (e.key === 'ArrowRight' ? 1 : modes.length - 1)) % modes.length];
  activate(next);
  tabs.querySelector(`[data-mode="${next.id}"]`).focus();
});

// ---- lifecycle ------------------------------------------------------------
// Browsers only allow audio after a user gesture.
window.addEventListener('pointerdown', () => synth.unlock(), { once: true, capture: true });
window.addEventListener('keydown', () => synth.unlock(), { once: true, capture: true });
// Never leave notes hanging when the tab loses focus.
window.addEventListener('blur', allOff);
document.addEventListener('visibilitychange', () => { if (document.hidden) { demo.stop(); allOff(); } });

applySettings();
activate(modes[0]);
