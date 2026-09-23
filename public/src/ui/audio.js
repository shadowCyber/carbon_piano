// Tiny Web Audio piano-ish synthesizer. No sample files, no network.
//
// Resource guard: polyphony is capped so a flood of note events (e.g. a faulty
// MIDI device) cannot exhaust audio nodes / CPU. Oldest voices are stolen.

import { frequency, isMidi } from '../core/music.js';

const MAX_VOICES = 12;
const ATTACK = 0.008;
const RELEASE = 0.12;

export class Synth {
  #ctx = null;
  #master = null;
  #voices = new Map();
  #volume = 0.7;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (!this.#ctx) {
      const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Ctx) return false;
      this.#ctx = new Ctx({ latencyHint: 'interactive' });
      const compressor = this.#ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.ratio.value = 4;
      this.#master = this.#ctx.createGain();
      this.#master.gain.value = this.#volume;
      this.#master.connect(compressor).connect(this.#ctx.destination);
    }
    if (this.#ctx.state === 'suspended') this.#ctx.resume().catch(() => {});
    return true;
  }

  setVolume(value) {
    this.#volume = Math.min(1, Math.max(0, Number(value) || 0));
    if (this.#master) this.#master.gain.setTargetAtTime(this.#volume, this.#ctx.currentTime, 0.02);
  }

  noteOn(midi, velocity = 0.8) {
    if (!isMidi(midi) || !this.unlock()) return;
    const ctx = this.#ctx;
    if (this.#voices.has(midi)) this.#stop(midi, 0.02);
    while (this.#voices.size >= MAX_VOICES) {
      this.#stop(this.#voices.keys().next().value, 0.02);
    }

    const now = ctx.currentTime;
    const f = frequency(midi);
    const peak = 0.35 * Math.min(1, Math.max(0.1, velocity));

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(peak, now + ATTACK);
    // Piano-like: fast initial decay, then a long natural fade even while held.
    env.gain.setTargetAtTime(peak * 0.4, now + ATTACK, 0.12);
    env.gain.setTargetAtTime(0.0001, now + 0.5, 1.6);
    env.connect(this.#master);

    const oscs = [
      this.#osc('triangle', f, 1.0, env, now),
      this.#osc('sine', f * 2, 0.18, env, now),
      this.#osc('sine', f * 3, 0.06, env, now),
    ];
    this.#voices.set(midi, { env, oscs });
  }

  #osc(type, freq, level, dest, when) {
    const ctx = this.#ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(dest);
    osc.start(when);
    return osc;
  }

  noteOff(midi) {
    if (this.#voices.has(midi)) this.#stop(midi, RELEASE);
  }

  #stop(midi, release) {
    const voice = this.#voices.get(midi);
    if (!voice) return;
    this.#voices.delete(midi);
    const now = this.#ctx.currentTime;
    voice.env.gain.cancelScheduledValues(now);
    voice.env.gain.setValueAtTime(voice.env.gain.value, now);
    voice.env.gain.setTargetAtTime(0, now, release / 3);
    for (const osc of voice.oscs) {
      osc.stop(now + release * 2);
      osc.onended = () => osc.disconnect();
    }
    setTimeout(() => voice.env.disconnect(), (release * 2 + 0.1) * 1000);
  }

  allOff() {
    for (const midi of [...this.#voices.keys()]) this.#stop(midi, 0.05);
  }
}
