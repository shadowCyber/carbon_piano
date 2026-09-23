// Treble-staff renderer (inline SVG, built node-by-node).

import { diatonicIndex, isBlackKey, noteInfo } from '../core/music.js';
import { s } from './dom.js';

const GAP = 14;            // distance between staff lines
const TOP = 40;            // y of the top line (F5)
const BOTTOM = TOP + GAP * 4; // y of the bottom line (E4)
const E4_INDEX = diatonicIndex(64);
const WIDTH = 220;
const HEIGHT = 160;

function yFor(midi) {
  return BOTTOM - (diatonicIndex(midi) - E4_INDEX) * (GAP / 2);
}

/**
 * @param {number|null} midi  note to draw, or null for an empty staff
 * @param {{label?: string}} opts
 */
export function renderStaff(midi, { label = 'Treble staff' } = {}) {
  const svg = s('svg', {
    class: 'staff',
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    role: 'img',
    'aria-label': midi === null ? label : `${label}: a note is shown`,
  });

  for (let i = 0; i < 5; i += 1) {
    const y = TOP + i * GAP;
    svg.append(s('line', { x1: 10, x2: WIDTH - 10, y1: y, y2: y, class: 'staff-line' }));
  }
  svg.append(s('text', { x: 14, y: BOTTOM + 12, class: 'clef' }, ['𝄞']));

  if (midi === null) return svg;

  const x = 130;
  const y = yFor(midi);
  const idx = diatonicIndex(midi);

  // Ledger lines below (C4 and lower) and above (A5 and higher).
  for (let step = E4_INDEX - 2; step >= idx; step -= 2) {
    const ly = BOTTOM - (step - E4_INDEX) * (GAP / 2);
    svg.append(s('line', { x1: x - 16, x2: x + 16, y1: ly, y2: ly, class: 'staff-line' }));
  }
  const F5_INDEX = E4_INDEX + 8;
  for (let step = F5_INDEX + 2; step <= idx; step += 2) {
    const ly = BOTTOM - (step - E4_INDEX) * (GAP / 2);
    svg.append(s('line', { x1: x - 16, x2: x + 16, y1: ly, y2: ly, class: 'staff-line' }));
  }

  if (isBlackKey(midi)) {
    svg.append(s('text', { x: x - 30, y: y + 6, class: 'accidental' }, ['♯']));
  }

  const letter = noteInfo(midi).letter;
  svg.append(s('ellipse', {
    cx: x, cy: y, rx: GAP * 0.62, ry: GAP * 0.45,
    transform: `rotate(-20 ${x} ${y})`,
    class: 'notehead',
    'data-letter': letter,
  }));
  // Stem: up for notes below the middle line (B4), down otherwise.
  const up = idx < E4_INDEX + 4;
  const sx = up ? x + GAP * 0.55 : x - GAP * 0.55;
  svg.append(s('line', { x1: sx, x2: sx, y1: y, y2: up ? y - GAP * 3.3 : y + GAP * 3.3, class: 'stem' }));
  return svg;
}
