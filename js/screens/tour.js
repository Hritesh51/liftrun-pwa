// First-launch walkthrough — 6 cards explaining the tabs + new features.
import { el, haptic } from '../util.js';
import * as S from '../state.js';

const STEPS = [
  { title: 'Welcome to LiftRun', body: 'Personal coach for lifting + running + diet. Built for one user — you. Everything runs on your phone.', icon: '👋' },
  { title: 'Today is your daily home', body: 'Tap "Start workout" or "Quick check-in". Daily readiness adapts your load automatically.', icon: '🗓' },
  { title: 'Program — your training', body: 'Push/Pull/Legs default. Switch to Bro Split or pick periodization style (Linear / DUP / Block).', icon: '💪' },
  { title: 'Diet — from your menu', body: 'Upload the mess menu once a week → AI builds daily eating plans with macros + supplements.', icon: '🥗' },
  { title: 'Run — GPS + races', body: 'Track runs, set race goals, get pace predictions. HR zones supported.', icon: '🏃' },
  { title: 'Coach — your AI', body: 'Free with Gemini or Groq. Voice debrief after sessions. Weekly strategy on Sundays.', icon: '🤖' },
  { title: 'Body & Progress', body: 'Photos, tape, bloodwork, movement screen, mobility, pain log. Track everything that matters for hypertrophy.', icon: '📈' },
];

export function renderTourSheet(sheetBody, ctx, router) {
  let idx = 0;
  redraw();
  function redraw() {
    const step = STEPS[idx];
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('div', { style: { textAlign: 'center', padding: '12px 0' } }, [
        el('div', { style: { fontSize: '48px', marginBottom: '12px' } }, step.icon),
        el('h2', { style: { margin: '0 0 8px' } }, step.title),
        el('p', { class: 'muted', style: { margin: 0, padding: '0 8px', lineHeight: 1.5 } }, step.body),
      ]),
      el('div', { style: { display: 'flex', gap: '4px', justifyContent: 'center', margin: '12px 0' } },
        STEPS.map((_, i) => el('span', {
          style: { width: '8px', height: '8px', borderRadius: '50%', background: i === idx ? 'var(--accent)' : 'var(--line)' },
        }))),
      el('div', { class: 'row-flex', style: { justifyContent: 'space-between', marginTop: '16px' } }, [
        idx > 0 ? el('button', { class: 'btn ghost', onclick: () => { idx--; haptic('light'); redraw(); } }, '← Back') : el('span', {}),
        idx < STEPS.length - 1
          ? el('button', { class: 'btn primary', onclick: () => { idx++; haptic('light'); redraw(); } }, 'Next →')
          : el('button', { class: 'btn primary lg', onclick: finish }, "Let's lift"),
      ]),
      el('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: finish }, 'Skip tour'),
    );
  }
  function finish() {
    S.update(s => { s.user.tourSeen = true; });
    router.closeSheet();
  }
}

export function shouldShowTour() {
  const s = S.get();
  return s.user?.onboarded && !s.user?.tourSeen;
}
