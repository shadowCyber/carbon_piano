// On-screen piano keyboard: rendering + pointer/touch + computer-keyboard input.

import { isBlackKey, midiRange, noteInfo } from '../core/music.js';
import { h } from './dom.js';

// Layout-independent physical key codes ("piano on the home row").
const KEY_CODES = Object.freeze({
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
  KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15,
  Semicolon: 16, Quote: 17,
});
const CODE_LABELS = Object.freeze({ Semicolon: ';', Quote: "'" });

export class PianoKeyboard {
  #keys = new Map();
  #pointerNotes = new Map();
  #codeNotes = new Map();
  #hint = null;

  constructor(container, { low, high, base = low, onNoteOn, onNoteOff }) {
    this.low = low;
    this.high = high;
    this.base = base;
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.root = h('div', { class: 'piano', attrs: { role: 'group', 'aria-label': 'Piano keyboard' } });
    container.replaceChildren(this.root);
    this.#render();
    this.#bindPointer();
    this.#bindKeys();
  }

  #render() {
    const notes = midiRange(this.low, this.high);
    const whiteCount = notes.filter((m) => !isBlackKey(m)).length;
    this.root.style.setProperty('--white-count', String(whiteCount));
    let whiteIndex = 0;
    for (const midi of notes) {
      const info = noteInfo(midi);
      const black = isBlackKey(midi);
      const key = h('div', {
        class: `key ${black ? 'black' : 'white'}`,
        dataset: { midi: String(midi), letter: info.letter },
        attrs: { role: 'button', 'aria-label': info.label },
      }, [
        h('span', { class: 'key-name', text: info.name }),
        h('span', { class: 'key-shortcut' }),
      ]);
      if (black) {
        key.style.setProperty('--pos', String(whiteIndex));
      } else {
        whiteIndex += 1;
      }
      this.#keys.set(midi, key);
      this.root.append(key);
    }
    this.#renderShortcuts();
  }

  #renderShortcuts() {
    for (const key of this.#keys.values()) key.querySelector('.key-shortcut').textContent = '';
    for (const [code, offset] of Object.entries(KEY_CODES)) {
      const key = this.#keys.get(this.base + offset);
      if (key) key.querySelector('.key-shortcut').textContent = CODE_LABELS[code] ?? code.slice(3);
    }
  }

  #press(midi, velocity) {
    this.onNoteOn?.(midi, velocity);
  }

  #release(midi) {
    this.onNoteOff?.(midi);
  }

  #bindPointer() {
    const midiFromTarget = (target) => {
      const key = target instanceof Element ? target.closest('.key') : null;
      return key && this.root.contains(key) ? Number(key.dataset.midi) : null;
    };

    this.root.addEventListener('pointerdown', (e) => {
      const midi = midiFromTarget(e.target);
      if (midi === null) return;
      e.preventDefault();
      // Touch pointers are implicitly captured; release so we can glide across keys.
      if (e.target.hasPointerCapture?.(e.pointerId)) e.target.releasePointerCapture(e.pointerId);
      this.#pointerNotes.set(e.pointerId, midi);
      this.#press(midi, 0.8);
    });

    this.root.addEventListener('pointerover', (e) => {
      if (!this.#pointerNotes.has(e.pointerId)) return;
      const midi = midiFromTarget(e.target);
      const prev = this.#pointerNotes.get(e.pointerId);
      if (midi === null || midi === prev) return;
      this.#release(prev);
      this.#pointerNotes.set(e.pointerId, midi);
      this.#press(midi, 0.7);
    });

    const end = (e) => {
      const midi = this.#pointerNotes.get(e.pointerId);
      if (midi === undefined) return;
      this.#pointerNotes.delete(e.pointerId);
      this.#release(midi);
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  #bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.code === 'KeyZ' || e.code === 'KeyX') {
        this.shiftOctave(e.code === 'KeyZ' ? -12 : 12);
        return;
      }
      const offset = KEY_CODES[e.code];
      if (offset === undefined) return;
      const midi = this.base + offset;
      if (midi < 0 || midi > 127) return;
      e.preventDefault();
      this.#codeNotes.set(e.code, midi);
      this.#press(midi, 0.8);
    });
    window.addEventListener('keyup', (e) => {
      const midi = this.#codeNotes.get(e.code);
      if (midi === undefined) return;
      this.#codeNotes.delete(e.code);
      this.#release(midi);
    });
  }

  shiftOctave(delta) {
    const next = this.base + delta;
    if (next < this.low - 12 || next > this.high - 12) return;
    this.releaseAll();
    this.base = next;
    this.#renderShortcuts();
  }

  /** Release everything this component is holding (e.g. window lost focus). */
  releaseAll() {
    for (const midi of this.#pointerNotes.values()) this.#release(midi);
    for (const midi of this.#codeNotes.values()) this.#release(midi);
    this.#pointerNotes.clear();
    this.#codeNotes.clear();
  }

  setPressed(midi, pressed) {
    this.#keys.get(midi)?.classList.toggle('pressed', pressed);
  }

  clearPressed() {
    for (const key of this.#keys.values()) key.classList.remove('pressed');
  }

  setHint(midi) {
    if (this.#hint !== null) this.#keys.get(this.#hint)?.classList.remove('hint');
    this.#hint = midi;
    if (midi !== null) this.#keys.get(midi)?.classList.add('hint');
  }

  flash(midi, kind) {
    const key = this.#keys.get(midi);
    if (!key) return;
    const cls = kind === 'good' ? 'flash-good' : 'flash-bad';
    key.classList.remove('flash-good', 'flash-bad');
    void key.offsetWidth; // restart CSS animation
    key.classList.add(cls);
    setTimeout(() => key.classList.remove(cls), 450);
  }
}

function isTyping(target) {
  return target instanceof Element
    && (target.closest('input, textarea, select, [contenteditable="true"]') !== null);
}
