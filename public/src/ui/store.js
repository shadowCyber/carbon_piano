// localStorage adapter. The only module permitted to touch Web Storage
// (enforced by scripts/check-security.mjs). All failures degrade to in-memory state.

import { STORAGE_KEY, parseProgress, serializeProgress } from '../core/progress.js';

export class ProgressStore {
  #songIds;
  #listeners = new Set();

  constructor(songIds) {
    this.#songIds = songIds;
    let text = null;
    try {
      text = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      // Storage disabled (private mode, policy): continue with defaults.
    }
    this.state = parseProgress(text, songIds);
  }

  update(fn) {
    this.state = fn(this.state);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, serializeProgress(this.state, this.#songIds));
    } catch {
      // Quota exceeded / storage disabled: keep the in-memory copy.
    }
    for (const listener of this.#listeners) listener(this.state);
  }

  reset() {
    try {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this.state = parseProgress(null, this.#songIds);
    for (const listener of this.#listeners) listener(this.state);
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
