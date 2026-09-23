// Progress overview (all data lives only in this browser).

import { SONGS } from '../core/songs.js';
import { button, h } from '../ui/dom.js';

export function createProgress(ctx) {
  const root = h('section', { class: 'panel progress' });

  function render() {
    const p = ctx.store.state;
    const totalStars = SONGS.reduce((sum, s) => sum + (p.songs[s.id]?.stars ?? 0), 0);
    root.replaceChildren(
      h('h2', { text: 'My Progress' }),
      h('div', { class: 'scoreboard big' }, [
        h('span', { text: `★ ${totalStars} / ${SONGS.length * 3} stars` }),
        h('span', { text: `Quiz best: ${p.quiz.name} (keys), ${p.quiz.staff} (staff)` }),
        h('span', { text: `Echo best: level ${p.echo.best}` }),
      ]),
      h('table', { class: 'progress-table' }, [
        h('thead', {}, [h('tr', {}, [h('th', { text: 'Song' }), h('th', { text: 'Stars' }), h('th', { text: 'Times played' })])]),
        h('tbody', {}, SONGS.map((s) => {
          const entry = p.songs[s.id] ?? { stars: 0, plays: 0 };
          return h('tr', {}, [
            h('td', { text: s.title }),
            h('td', { class: 'stars', text: '★'.repeat(entry.stars) + '☆'.repeat(3 - entry.stars) }),
            h('td', { text: String(entry.plays) }),
          ]);
        })),
      ]),
      h('p', { class: 'muted small', text: 'Progress is saved only on this device. Nothing is sent anywhere.' }),
      button('Reset all progress', () => {
        // eslint-disable-next-line no-alert
        if (window.confirm('Erase all stars and scores on this device?')) {
          ctx.store.reset();
          ctx.applySettings();
          render();
        }
      }, { className: 'btn danger' }),
    );
  }

  return { id: 'progress', label: 'Progress', root, enter: render, exit() {}, onNoteOn() {} };
}
