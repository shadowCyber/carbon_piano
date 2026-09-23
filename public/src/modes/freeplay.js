// Free play: play anything, see its name and where it lives on the staff.

import { noteInfo } from '../core/music.js';
import { h } from '../ui/dom.js';
import { renderStaff } from '../ui/staff.js';

export function createFreePlay() {
  const bigName = h('div', { class: 'big-note', text: '♪' });
  const label = h('div', { class: 'muted', text: 'Press any key to start playing!' });
  const staffBox = h('div', { class: 'staff-box' }, [renderStaff(null)]);

  const root = h('section', { class: 'panel freeplay' }, [
    h('h2', { text: 'Free Play' }),
    h('div', { class: 'freeplay-grid' }, [h('div', { class: 'center' }, [bigName, label]), staffBox]),
    h('p', { class: 'tip' }, [
      'Tip: on a computer, the row ', h('kbd', { text: 'A S D F G H J K' }),
      ' plays the white keys. ', h('kbd', { text: 'Z' }), ' / ', h('kbd', { text: 'X' }),
      ' move down / up an octave.',
    ]),
  ]);

  return {
    id: 'free',
    label: 'Free Play',
    root,
    enter() {},
    exit() {},
    onNoteOn(midi) {
      const info = noteInfo(midi);
      bigName.textContent = info.name;
      bigName.dataset.letter = info.letter;
      label.textContent = info.midi === 60 ? `${info.label} — Middle C!` : info.label;
      // Staff only covers the treble range sensibly.
      staffBox.replaceChildren(renderStaff(midi >= 55 && midi <= 88 ? midi : null));
    },
  };
}
