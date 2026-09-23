// Song lessons: pick a song, listen to it, then play along note by note.

import { Lesson } from '../core/lesson.js';
import { noteInfo } from '../core/music.js';
import { SONGS } from '../core/songs.js';
import { withSongResult } from '../core/progress.js';
import { button, h } from '../ui/dom.js';

const LANE_SIZE = 10;
const PRAISE = ['Great job!', 'Awesome!', 'You did it!', 'Fantastic!', 'Super playing!'];

function starText(n) {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

export function createSongs(ctx) {
  const root = h('section', { class: 'panel songs' });
  let lesson = null;
  let showHints = true;
  let listening = false;

  // ---------- song picker ----------
  function renderPicker() {
    lesson = null;
    ctx.keyboard.setHint(null);
    const progress = ctx.store.state.songs;
    const list = h('ul', { class: 'song-list' }, SONGS.map((song) => {
      const stars = progress[song.id]?.stars ?? 0;
      return h('li', {}, [
        h('button', {
          class: 'song-card',
          attrs: { type: 'button', 'aria-label': `${song.title}, level ${song.level}, ${stars} of 3 stars` },
          dataset: { level: String(song.level) },
          on: { click: () => startLesson(song) },
        }, [
          h('span', { class: 'song-title', text: song.title }),
          h('span', { class: 'song-meta' }, [
            h('span', { class: 'level', text: `Level ${song.level}` }),
            h('span', { class: 'stars', text: starText(stars) }),
          ]),
        ]),
      ]);
    }));
    root.replaceChildren(h('h2', { text: 'Songs' }), h('p', { class: 'muted', text: 'Pick a song. Listen first, then play along with the glowing keys.' }), list);
  }

  // ---------- lesson view ----------
  const lane = h('ol', { class: 'note-lane', attrs: { 'aria-label': 'Upcoming notes' } });
  const bar = h('div', { class: 'progress-bar' }, [h('div', { class: 'progress-fill' })]);
  const title = h('h2');
  const listenBtn = button('▶ Listen', () => toggleListen(), { className: 'btn primary' });
  const hintToggle = h('input', { attrs: { type: 'checkbox', checked: true }, on: { change: (e) => { showHints = e.target.checked; updateHint(); } } });

  function startLesson(song) {
    lesson = new Lesson(song);
    title.textContent = song.title;
    hintToggle.checked = showHints;
    root.replaceChildren(
      h('div', { class: 'lesson-head' }, [
        button('← Songs', () => { stopListen(); renderPicker(); }, { className: 'btn ghost' }),
        title,
      ]),
      bar,
      lane,
      h('div', { class: 'controls' }, [
        listenBtn,
        button('↺ Start over', () => { stopListen(); startLesson(lesson.song); ctx.say('From the top!'); }),
        h('label', { class: 'toggle' }, [hintToggle, ' Show me the key']),
      ]),
    );
    refresh();
    ctx.say(`${song.title}. Press Listen to hear it, or start playing!`);
  }

  function refresh() {
    if (!lesson) return;
    const start = Math.max(0, lesson.index - 2);
    const items = lesson.notes.slice(start, start + LANE_SIZE).map((note, i) => {
      const idx = start + i;
      const info = noteInfo(note.midi);
      const state = idx < lesson.index ? 'done' : idx === lesson.index ? 'current' : 'todo';
      return h('li', { class: `lane-note ${state}`, dataset: { letter: info.letter } }, [info.name]);
    });
    lane.replaceChildren(...items);
    bar.firstChild.style.width = `${Math.round(lesson.progress * 100)}%`;
    updateHint();
  }

  function updateHint() {
    ctx.keyboard.setHint(lesson && showHints && !listening ? lesson.expected : null);
  }

  function toggleListen() {
    if (listening) { stopListen(); return; }
    listening = true;
    listenBtn.textContent = '■ Stop';
    updateHint();
    ctx.demo.play(lesson.song.notes, lesson.song.bpm, { onDone: stopListen });
  }

  function stopListen() {
    if (!listening) return;
    listening = false;
    ctx.demo.stop();
    listenBtn.textContent = '▶ Listen';
    updateHint();
  }

  function finish() {
    const stars = lesson.stars();
    const songId = lesson.song.id;
    ctx.store.update((p) => withSongResult(p, songId, stars));
    ctx.keyboard.setHint(null);
    const msg = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    ctx.say(`${msg} ${starText(stars)}`, 'good');
    root.append(h('div', { class: 'celebrate' }, [
      h('div', { class: 'stars big', text: starText(stars) }),
      h('p', { text: lesson.mistakes === 0 ? 'Perfect — no mistakes!' : `Only ${lesson.mistakes} oops. Try again for more stars!` }),
      h('div', { class: 'controls' }, [
        button('Play again', () => startLesson(lesson.song), { className: 'btn primary' }),
        button('More songs', renderPicker),
      ]),
    ]));
  }

  return {
    id: 'songs',
    label: 'Songs',
    root,
    enter() { renderPicker(); },
    exit() { stopListen(); ctx.keyboard.setHint(null); },
    onNoteOn(midi) {
      if (!lesson || listening || lesson.done) return;
      const res = lesson.press(midi);
      if (res.result === 'correct') {
        ctx.keyboard.flash(midi, 'good');
        refresh();
        if (res.done) finish();
      } else if (res.result === 'wrong') {
        ctx.keyboard.flash(midi, 'bad');
        ctx.say(`Oops! Look for ${noteInfo(res.expected).name}.`, 'bad');
      }
    },
  };
}
