// Strict parser for raw MIDI messages from external hardware (Web MIDI API).
// Hardware input is untrusted: malformed or unexpected messages are dropped.
// SysEx is never requested, so only short channel messages are expected here.

export function parseMidiMessage(data) {
  if (!data || typeof data.length !== 'number' || data.length < 2 || data.length > 3) return null;
  const status = data[0];
  const d1 = data[1];
  const d2 = data.length === 3 ? data[2] : 0;
  if (!Number.isInteger(status) || status < 0x80 || status > 0xef) return null;
  if (!Number.isInteger(d1) || d1 < 0 || d1 > 127) return null;
  if (!Number.isInteger(d2) || d2 < 0 || d2 > 127) return null;

  const command = status & 0xf0;
  if (command === 0x90 && d2 > 0) return { type: 'noteOn', note: d1, velocity: d2 / 127 };
  if (command === 0x80 || (command === 0x90 && d2 === 0)) return { type: 'noteOff', note: d1 };
  // CC 120 (All Sound Off) / CC 123 (All Notes Off): release everything.
  if (command === 0xb0 && (d1 === 120 || d1 === 123)) return { type: 'allOff' };
  return null;
}
