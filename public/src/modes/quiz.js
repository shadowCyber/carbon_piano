// Note quiz: "find the key" (name -> key) or "read the staff" (staff -> key).

import { noteInfo } from '../core/music.js';
import { NoteQuiz, QUIZ_MODES, QUIZ_POOLS } from '../core/quiz.js';
import { withQuizBest } from '../core/progress.js';
import { button, h } from '../ui/dom.js';
import { renderStaff } from '../ui/staff.js';

export function createQuiz(ctx) {
  let mode = QUIZ_MODES.NAME;
  let hard = false;
  let quiz = null;
  let advanceTimer = null;

  const prompt = h('div', { class: 'quiz-prompt', attrs: { 'aria-live': 'polite' } });
  const score = h('div', { class: 'scoreboard' });
  const modeName = button('Find the Key', () => setMode(QUIZ_MODES.NAME), { className: 'seg', attrs: { 'aria-pressed': 'true' } });
  const modeStaff = button('Read the Staff', () => setMode(QUIZ_MODES.STAFF), { className: 'seg', attrs: { 'aria-pressed': 'false' } });
  const hardToggle = h('input', { attrs: { type: 'checkbox' }, on: { change: (e) => { hard = e.target.checked; restart(); } } });
  const hardLabel = h('span');

  const root = h('section', { class: 'panel quiz' }, [
    h('h2', { text: 'Note Quiz' }),
    h('div', { class: 'controls' }, [
      h('div', { class: 'segmented', attrs: { role: 'group', 'aria-label': 'Quiz type' } }, [modeName, modeStaff]),
      h('label', { class: 'toggle' }, [hardToggle, hardLabel]),
    ]),
    prompt,
    h('div', { class: 'controls' }, [
      button('🔊 Hear it', () => { if (quiz?.current != null) ctx.playNote(quiz.current); }),
      button('Skip', () => nextQuestion()),
    ]),
    score,
  ]);

  function setMode(next) {
    mode = next;
    modeName.setAttribute('aria-pressed', String(mode === QUIZ_MODES.NAME));
    modeStaff.setAttribute('aria-pressed', String(mode === QUIZ_MODES.STAFF));
    restart();
  }

  function pool() {
    if (mode === QUIZ_MODES.NAME) return hard ? QUIZ_POOLS.nameAll : QUIZ_POOLS.nameEasy;
    return hard ? QUIZ_POOLS.staffHard : QUIZ_POOLS.staffEasy;
  }

  function restart() {
    clearTimeout(advanceTimer);
    hardLabel.textContent = mode === QUIZ_MODES.NAME ? ' Include black keys' : ' Higher notes too';
    quiz = new NoteQuiz({ mode, pool: pool() });
    nextQuestion();
  }

  function nextQuestion() {
    clearTimeout(advanceTimer);
    const target = quiz.next();
    const info = noteInfo(target);
    if (mode === QUIZ_MODES.NAME) {
      prompt.replaceChildren(
        h('div', { class: 'muted', text: 'Find any…' }),
        h('div', { class: 'big-note', dataset: { letter: info.letter }, text: info.name }),
      );
    } else {
      prompt.replaceChildren(
        h('div', { class: 'muted', text: 'Play this note:' }),
        h('div', { class: 'staff-box' }, [renderStaff(target, { label: 'Quiz note' })]),
      );
    }
    renderScore();
  }

  function renderScore() {
    const best = ctx.store.state.quiz[mode];
    score.replaceChildren(
      h('span', { text: `Score: ${quiz.score}` }),
      h('span', { text: `Streak: ${quiz.streak}` }),
      h('span', { text: `Best streak: ${best}` }),
    );
  }

  return {
    id: 'quiz',
    label: 'Note Quiz',
    root,
    enter() { restart(); },
    exit() { clearTimeout(advanceTimer); },
    onNoteOn(midi) {
      if (!quiz || quiz.current === null) return;
      const res = quiz.answer(midi);
      if (res.result === 'correct') {
        ctx.keyboard.flash(midi, 'good');
        ctx.store.update((p) => withQuizBest(p, mode, quiz.bestStreak));
        ctx.say(res.streak >= 5 && res.streak % 5 === 0 ? `${res.streak} in a row! 🔥` : 'Yes! That\'s it!', 'good');
        renderScore();
        advanceTimer = setTimeout(nextQuestion, 700);
      } else if (res.result === 'wrong') {
        ctx.keyboard.flash(midi, 'bad');
        ctx.say(`That was ${noteInfo(midi).name}. Try again!`, 'bad');
        renderScore();
      }
    },
  };
}
