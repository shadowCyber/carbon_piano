// Schedules a melody for demo playback. Returns a cancel function.

export function playMelody(notes, { bpm, onNoteStart, onNoteEnd, onDone }) {
  const beatMs = 60000 / Math.min(240, Math.max(30, bpm));
  const timers = [];
  const sounding = new Set();
  let t = 250; // short lead-in
  notes.forEach((note, i) => {
    const dur = note.beats * beatMs;
    if (note.midi !== null) {
      const midi = note.midi;
      timers.push(setTimeout(() => { sounding.add(midi); onNoteStart?.(midi, i); }, t));
      timers.push(setTimeout(() => { sounding.delete(midi); onNoteEnd?.(midi, i); }, t + dur * 0.88));
    }
    t += dur;
  });
  timers.push(setTimeout(() => onDone?.(), t));

  return function cancel() {
    timers.forEach(clearTimeout);
    for (const midi of sounding) onNoteEnd?.(midi, -1);
    sounding.clear();
  };
}
