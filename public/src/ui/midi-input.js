// Optional hardware keyboard support via Web MIDI.
// - Opt-in only (explicit button press), never requested at load.
// - SysEx is explicitly NOT requested (sysex allows device firmware access).
// - Every incoming message goes through the strict parser in core/midi-message.js.

import { parseMidiMessage } from '../core/midi-message.js';

export function midiSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

export async function connectMidi({ onNoteOn, onNoteOff, onAllOff, onDevicesChanged }) {
  if (!midiSupported()) throw new Error('Web MIDI is not supported in this browser.');
  const access = await navigator.requestMIDIAccess({ sysex: false, software: false });

  const handle = (event) => {
    const msg = parseMidiMessage(event.data);
    if (!msg) return;
    if (msg.type === 'noteOn') onNoteOn(msg.note, msg.velocity);
    else if (msg.type === 'noteOff') onNoteOff(msg.note);
    else if (msg.type === 'allOff') onAllOff();
  };

  const attach = () => {
    const names = [];
    for (const input of access.inputs.values()) {
      input.onmidimessage = handle;
      names.push(String(input.name ?? 'MIDI device').slice(0, 60));
    }
    onDevicesChanged?.(names);
  };

  access.onstatechange = () => {
    onAllOff(); // a device vanished mid-note: avoid stuck notes
    attach();
  };
  attach();
  return access;
}
