// Skip / change today's workout sheet — opens from Today screen.
// Options: skip + advance, postpone (stay on this day next time), replace with bodyweight version,
// active recovery only, pick a different day from either week, full rest.
import { el, toast, haptic } from '../util.js';
import * as S from '../state.js';
import { advanceDay, overrideToday } from '../engine.js';

export function renderSkipSheet(sheetBody, ctx, router) {
  const s = S.get();
  const prog = s.programs[s.schedule.currentWeekType];
  const allDays = [
    ...(s.programs.A?.days || []).map(d => ({ ...d, week: 'A' })),
    ...(s.programs.B?.days || []).map(d => ({ ...d, week: 'B' })),
  ];

  sheetBody.replaceChildren(
    el('div', { class: 'grabber' }),
    el('h2', { style: { margin: '0 0 4px' } }, 'Change today'),
    el('p', { class: 'muted', style: { marginTop: 0 } }, 'Pick how to handle today. Smart recovery is better than forcing a bad session.'),

    // Option 1: Skip + advance
    optionCard('Skip & advance',
      'Mark today as skipped and move on. Tomorrow becomes the next planned day.',
      'Skip',
      () => {
        // Create a placeholder skipped session for adherence tracking
        const today = ctx?.day || prog.days[s.schedule.nextDayIndex];
        const ses = S.startSession(today.id, today.name);
        S.endSession(ses.id, { skipped: true });
        advanceDay();
        toast('Skipped — moved on');
        router.closeSheet();
        router.refresh();
      }),

    // Option 2: Postpone — stay on this day, just lose the slot
    optionCard('Postpone (do it tomorrow)',
      'Push today\'s workout to tomorrow. Schedule stays the same — you just shift one day.',
      'Postpone',
      () => {
        // Don't advance. The same day stays planned.
        // Adherence calendar will show today as no-session.
        toast('Today shifted — same workout planned for tomorrow');
        router.closeSheet();
        router.refresh();
      }),

    // Option 3: Replace with bodyweight (travel mode for this week)
    optionCard('Bodyweight version',
      'Do today\'s session with bodyweight subs (no gym needed). Toggles travel mode for the week.',
      'Use bodyweight',
      () => {
        S.setTravelMode(true);
        toast('Travel mode ON — bodyweight subs in your workout');
        router.closeSheet();
        router.refresh();
      }),

    // Option 4: Active recovery only
    optionCard('Active recovery only',
      'Skip lifting today. Log a 20-min Z2 walk/run or mobility work instead.',
      'Active recovery',
      () => {
        const today = prog.days[s.schedule.nextDayIndex];
        const ses = S.startSession(today.id, today.name);
        S.endSession(ses.id, { skipped: true, notes: 'Active recovery — Z2 / mobility' });
        advanceDay();
        toast('Logged active recovery — go for a walk');
        router.closeSheet();
        router.go('run');
      }),

    // Option 5: Pick a different day
    el('div', { class: 'card flat' }, [
      el('div', { class: 'eyebrow' }, ['Do a different day today']),
      el('p', { class: 'faint', style: { margin: '4px 0 8px' } }, 'Override today\'s session. Schedule resumes tomorrow.'),
      el('div', { class: 'list' }, allDays.filter(d => d.slots?.length).map((d, i) => {
        const idx = (s.programs[d.week]?.days || []).findIndex(x => x.id === d.id);
        return el('div', { class: 'list-item' }, [
          el('div', {}, [
            el('div', { style: { fontWeight: 600 } }, d.name),
            el('div', { class: 'faint' }, `Week ${d.week} · ${d.slots.length} lifts`),
          ]),
          el('button', { class: 'btn sm', onclick: () => {
            overrideToday(d.week, idx);
            toast(`Today: ${d.name}`);
            router.closeSheet();
            router.refresh();
          } }, 'Do today'),
        ]);
      })),
    ]),

    // Option 6: Full rest, no advance
    optionCard('Full rest — no change',
      'Just close this. Schedule stays exactly as it is.',
      'Cancel',
      () => router.closeSheet(),
      'ghost'),
  );
}

function optionCard(title, desc, btn, onClick, btnClass = '') {
  return el('div', { class: 'card flat' }, [
    el('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' } }, [
      el('div', { style: { flex: 1, minWidth: 0 } }, [
        el('div', { style: { fontWeight: 600 } }, title),
        el('div', { class: 'faint', style: { fontSize: '13px', marginTop: '2px' } }, desc),
      ]),
      el('button', { class: `btn sm ${btnClass}`, onclick: () => { haptic('light'); onClick(); } }, btn),
    ]),
  ]);
}
