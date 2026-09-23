// Echo game: listen to a growing melody and play it back.

import { EchoGame } from '../core/echo.js';
import { midiRange, whiteKeysIn } from '../core/music.js';
import { withEchoBest } from '../core/progress.js';
import { button, h } from '../ui/dom.js';

const POOLS = Object.freeze({
  easy: Object.freeze(whiteKeysIn(60, 67)),    // C D E F G
  medium: Object.freeze(whiteKeysIn(60, 72)),  // C..C
  hard: Object.freeze(midiRange(60, 72)),      // chromatic
});
const LISTEN_BPM = 100;

export function createEcho(ctx) {
  let game = null;
  let difficulty = 'easy';
  let pending = null;

  const status = h('div', { class: 'echo-status', text: 'Ready?' });
  const stats = h('div', { class: 'scoreboard' });
  const startBtn = button('Start', () => start(), { className: 'btn primary' });
  const select = h('select', { attrs: { 'aria-label': 'Difficulty' }, on: { change: (e) => { difficulty = e.target.value; reset(); } } }, [
    h('option', { attrs: { value: 'easy' }, text: 'Easy (C to G)' }),
    h('option', { attrs: { value: 'medium' }, text: 'Medium (C to C)' }),
    h('option', { attrs: { value: 'hard' }, text: 'Hard (black keys too)' }),
  ]);

  const root = h('section', { class: 'panel echo' }, [
    h('h2', { text: 'Echo Game' }),
    h('p', { class: 'muted', text: 'Listen to the notes, then play them back. Each round adds one more!' }),
    h('div', { class: 'controls' }, [startBtn, select]),
    status,
    stats,
  ]);

  function renderStats() {
    const hearts = game ? '❤'.repeat(game.lives) + '♡'.repeat(game.maxLives - game.lives) : '';
    stats.replaceChildren(
      h('span', { text: `Level: ${game?.level ?? 0}` }),
      h('span', { class: 'hearts', text: hearts, attrs: { 'aria-label': `${game?.lives ?? 0} lives` } }),
      h('span', { text: `Best: ${ctx.store.state.echo.best}` }),
    );
  }

  function reset() {
    clearTimeout(pending);
    ctx.demo.stop();
    game = null;
    status.textContent = 'Ready?';
    startBtn.textContent = 'Start';
    renderStats();
  }

  function start() {
    reset();
    game = new EchoGame({ pool: POOLS[difficulty] });
    game.start();
    startBtn.textContent = 'Restart';
    renderStats();
    playRound();
  }

  function playRound() {
    status.textContent = 'Listen… 👂';
    status.dataset.phase = 'listen';
    const notes = game.sequence.map((midi) => ({ midi, beats: 1 }));
    pending = setTimeout(() => {
      ctx.demo.play(notes, LISTEN_BPM, {
        onDone: () => {
          if (!game) return;
          game.beginInput();
          status.textContent = 'Your turn! 🎹';
          status.dataset.phase = 'input';
        },
      });
    }, 500);
  }

  return {
    id: 'echo',
    label: 'Echo Game',
    root,
    enter() { reset(); },
    exit() { reset(); },
    onNoteOn(midi) {
      if (!game) return;
      const res = game.press(midi);
      switch (res.result) {
        case 'correct':
          ctx.keyboard.flash(midi, 'good');
          break;
        case 'levelUp':
          ctx.keyboard.flash(midi, 'good');
          ctx.store.update((p) => withEchoBest(p, res.level));
          ctx.say(`Level ${res.level}! 🎉`, 'good');
          renderStats();
          pending = setTimeout(playRound, 700);
          break;
        case 'retry':
          ctx.keyboard.flash(midi, 'bad');
          ctx.say('Oops! Listen again…', 'bad');
          renderStats();
          pending = setTimeout(playRound, 900);
          break;
        case 'gameOver':
        case 'won':
          ctx.keyboard.flash(midi, res.result === 'won' ? 'good' : 'bad');
          ctx.store.update((p) => withEchoBest(p, res.level));
          status.textContent = res.result === 'won' ? 'You beat the game! 🏆' : `Game over — you reached level ${res.level}!`;
          status.dataset.phase = 'over';
          renderStats();
          break;
        default:
          break;
      }
    },
  };
}
