import { el, toast, fmtDate } from '../util.js';
import * as S from '../state.js';
import { overrideToday, todayDay } from '../engine.js';
import { PROGRAMS, EXERCISE_INDEX } from '../seed.js';
import { mesoState } from '../meso.js';
import { staleExercises } from '../fatigue.js';
import { confirmAction } from '../ui.js';

export function render(view, router) {
  const s = S.get();
  const wt = s.schedule.currentWeekType;

  const meso = mesoState();
  const stale = staleExercises(6);

  view.replaceChildren(el('div', {}, [
    el('div', { class: 'h-row' }, [
      el('h1', {}, 'Program'),
      el('span', { class: 'pill accent' }, [`Active: Week ${wt}`]),
    ]),

    // ---- Periodization style ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Periodization style']),
      el('div', { class: 'row-flex', style: { marginTop: '8px' } }, [
        ...[
          { id: 'linear', label: 'Linear', desc: 'Steady ramp' },
          { id: 'dup', label: 'DUP', desc: 'Heavy/Hyp/Light rotates daily' },
          { id: 'block', label: 'Block', desc: 'Volume → Intensity → Deload' },
        ].map(opt => el('button', {
          class: `btn sm ${s.periodizationStyle === opt.id ? 'primary' : ''}`,
          style: { flex: 1 },
          onclick: () => { S.setPeriodizationStyle(opt.id); toast(`${opt.label} style enabled`); router.refresh(); },
        }, opt.label)),
      ]),
      el('p', { class: 'faint', style: { margin: '6px 0 0' } }, [
        ({linear:'Linear: a steady volume ramp — best for beginners.',dup:'DUP: rep range and load rotate each session within the week.',block:'Block: 3 weeks volume → 2 weeks intensity → deload.'}[s.periodizationStyle || 'linear']),
      ]),
    ]),

    // ---- Mesocycle ----
    el('div', { class: 'card' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', { class: 'eyebrow' }, ['Mesocycle']),
        meso.active
          ? el('button', { class: 'btn sm ghost', onclick: () => { S.endMeso(); router.refresh(); } }, 'End')
          : el('button', { class: 'btn sm primary', onclick: () => { S.startMeso(5); toast('5-week meso started'); router.refresh(); } }, 'Start 5-week meso'),
      ]),
      meso.active
        ? el('div', { style: { marginTop: '8px' } }, [
            el('p', {}, [el('strong', {}, `Week ${meso.currentWeek} / ${meso.lengthWeeks}`), el('span', { class: 'faint' }, ` · ${Math.round(meso.multiplier * 100)}% planned volume${meso.isDeloadWeek ? ' (DELOAD)' : ''}`)]),
            el('div', { style: { height: '6px', background: 'var(--bg-3)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' } }, [
              el('div', { style: { width: `${(meso.currentWeek / meso.lengthWeeks) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width .3s' } }),
            ]),
          ])
        : el('p', { class: 'faint' }, '4–6 week arcs that ramp volume then deload. Best for ongoing hypertrophy gains.'),
    ]),

    // ---- Rotation suggestions ----
    stale.length ? el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Exercise rotation suggestions']),
      el('p', { class: 'faint' }, 'These exercises have stalled or run their course. Consider swapping for a variation.'),
      el('div', { class: 'list' }, stale.slice(0, 5).map(st => {
        const ex = EXERCISE_INDEX[st.exerciseId];
        return el('div', { class: 'list-item' }, [
          el('div', {}, [
            el('div', { style: { fontWeight: 600 } }, ex?.name || st.exerciseId),
            el('div', { class: 'faint' }, st.reason === 'regression' ? `Down ${st.dropPct}% in last 4 weeks` : `Same lift for ${st.weeksSinceRotation || 6}+ weeks`),
          ]),
          el('button', { class: 'btn sm', onclick: () => { S.markExerciseRotated(st.exerciseId); toast('Marked rotated — swap in Program editor below'); router.refresh(); } }, 'Mark'),
        ]);
      })),
    ]) : null,

    // ---- Travel mode ----
    el('div', { class: 'card' }, [
      el('div', { class: 'toggle' }, [
        el('div', {}, [
          el('div', { class: 'label' }, 'Travel mode (this week)'),
          el('div', { class: 'faint' }, 'Substitutes bodyweight versions of each exercise.'),
        ]),
        el('button', { class: 'switch', 'aria-checked': String(s.travelMode), onclick: (e) => {
          const v = !s.travelMode;
          S.setTravelMode(v);
          e.currentTarget.setAttribute('aria-checked', String(v));
          toast(v ? 'Travel mode ON' : 'Travel mode OFF');
        } }),
      ]),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'toggle' }, [
        el('div', {}, [
          el('div', { class: 'label' }, 'Alternate Week A / Week B'),
          el('div', { class: 'faint' }, 'When ON, the app flips between PPL and bro split each week.'),
        ]),
        el('button', { class: 'switch', 'aria-checked': String(s.settings.autoAlternateWeeks), onclick: (e) => {
          const v = !s.settings.autoAlternateWeeks;
          S.setSetting('autoAlternateWeeks', v);
          e.currentTarget.setAttribute('aria-checked', String(v));
          toast(v ? 'Alternating enabled' : 'Sticking with current week');
        } }),
      ]),
      el('div', { class: 'row-flex', style: { marginTop: '8px' } }, [
        el('button', { class: `btn sm ${wt === 'A' ? 'primary' : ''}`, onclick: () => switchTo('A') }, 'Use PPL'),
        el('button', { class: `btn sm ${wt === 'B' ? 'primary' : ''}`, onclick: () => switchTo('B') }, 'Use Bro Split'),
      ]),
    ]),

    s.settings.showBroSplitNote && wt === 'B' ? el('div', { class: 'card' }, [
      el('strong', {}, 'Coaching note'),
      el('p', { class: 'muted', style: { margin: '6px 0 8px' } }, "A bro split trains each muscle once per week, which is less optimal for a beginner than running PPL twice. Use it as variety, not your staple. The app supports it because you wanted it."),
      el('button', { class: 'btn sm ghost', onclick: () => { S.setSetting('showBroSplitNote', false); router.refresh(); } }, "Got it, don't show again"),
    ]) : null,

    renderProgramEditor('A', router),
    renderProgramEditor('B', router),

    el('div', { class: 'card flat' }, [
      el('div', { class: 'eyebrow' }, ['Reset']),
      el('button', { class: 'btn sm danger', onclick: async () => {
        if (!await confirmAction({ title: 'Reset both programs?', body: 'Restores the default PPL + Bro Split templates. Your logged history is kept.', confirmLabel: 'Reset' })) return;
        S.update(s => { s.programs.A = JSON.parse(JSON.stringify(PROGRAMS.A)); s.programs.B = JSON.parse(JSON.stringify(PROGRAMS.B)); });
        toast('Reset to defaults');
        router.refresh();
      } }, 'Reset templates'),
    ]),
  ]));

  function switchTo(t) {
    S.setSchedule({ currentWeekType: t, nextDayIndex: 0 });
    toast(`Switched to ${t === 'A' ? 'PPL' : 'Bro Split'}`);
    router.refresh();
  }
}

function renderProgramEditor(weekType, router) {
  const s = S.get();
  const prog = s.programs[weekType];
  return el('div', { class: 'card' }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
      el('h2', { style: { margin: 0 } }, `Week ${weekType} · ${prog.name}`),
    ]),
    el('div', { class: 'list' }, prog.days.map((d, i) => el('div', { class: 'list-item' }, [
      el('div', {}, [
        el('div', { style: { fontWeight: 600 } }, `${i + 1}. ${d.name}`),
        el('div', { class: 'faint' }, d.slots.length ? `${d.slots.length} lifts` : 'Rest day'),
      ]),
      el('span', { class: 'meta' }, [
        d.slots.length ? el('button', { class: 'btn sm', onclick: () => router.go(`programDay/${weekType}/${i}`) }, 'Edit') : null,
        ' ',
        d.slots.length ? el('button', { class: 'btn sm ghost', onclick: () => { overrideToday(weekType, i); toast(`Today: ${d.name}`); router.go('today'); } }, 'Do today') : null,
      ]),
    ]))),
  ]);
}

// Day editor sub-screen
export function renderDay(view, router, params) {
  const { weekType, dayIndex } = params;
  const s = S.get();
  const prog = s.programs[weekType];
  const day = prog.days[Number(dayIndex)];
  if (!day) { view.replaceChildren(el('div', {}, 'Day not found')); return; }
  redraw();

  function redraw() {
    view.replaceChildren(el('div', {}, [
      el('div', { class: 'h-row' }, [
        el('button', { class: 'btn icon', onclick: () => router.go('program'), 'aria-label': 'Back' }, [
          el('span', { html: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>' }),
        ]),
        el('h1', { style: { flex: 1, fontSize: '22px' } }, `${day.name}`),
      ]),
      el('div', { class: 'card' }, day.slots.length ? day.slots.map((slot, i) => renderSlot(slot, i, day, weekType, redraw, router)) : [el('p', { class: 'muted' }, 'Rest day. Active recovery or an easy run.')]),
      day.slots.length ? el('button', { class: 'btn block', onclick: () => router.openSheet('addExercise', { weekType, dayIndex }) }, '+ Add exercise') : null,
    ]));
  }
}

function renderSlot(slot, i, day, weekType, refresh, router) {
  const ex = S.getExercise(slot.exerciseId);
  return el('div', { class: 'list-item' }, [
    el('div', { style: { flex: 1 } }, [
      el('div', { style: { fontWeight: 600 } }, ex?.name || slot.exerciseId),
      el('div', { class: 'faint' }, `${slot.sets} × ${slot.repLow}${slot.repLow !== slot.repHigh ? '–' + slot.repHigh : ''} · ${slot.restSec}s rest`),
    ]),
    el('button', { class: 'btn sm ghost', onclick: () => editSlot() }, 'Edit'),
    el('button', { class: 'btn sm ghost danger', onclick: () => removeSlot() }, '✕'),
  ]);

  function editSlot() {
    openSlotEditor(slot, (updated) => {
      S.update(s => {
        const d = s.programs[weekType].days.find(dd => dd.id === day.id);
        d.slots[i] = { ...slot, ...updated };
      });
      refresh();
    });
  }
  async function removeSlot() {
    if (!await confirmAction({ title: 'Remove this exercise?', confirmLabel: 'Remove' })) return;
    S.update(s => {
      const d = s.programs[weekType].days.find(dd => dd.id === day.id);
      d.slots.splice(i, 1);
    });
    refresh();
  }
}

// Inline slot editor — a small modal with steppers (replaces 4 native prompts).
function openSlotEditor(slot, onSave) {
  const draft = { sets: slot.sets, repLow: slot.repLow, repHigh: slot.repHigh, restSec: slot.restSec };
  const back = el('div', { style: { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.55)', zIndex: '300', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } });
  const stepper = (label, key, min, max, step) => el('div', { class: 'field' }, [
    el('label', {}, label),
    el('div', { class: 'stepper', style: { maxWidth: '180px' } }, [
      el('button', { type: 'button', onclick: () => { draft[key] = Math.max(min, draft[key] - step); render(); }, haptic: 'tap' }, '–'),
      el('input', { type: 'number', value: String(draft[key]), oninput: e => { const v = parseInt(e.target.value, 10); if (Number.isFinite(v)) draft[key] = v; } }),
      el('button', { type: 'button', onclick: () => { draft[key] = Math.min(max, draft[key] + step); render(); } }, '+'),
    ]),
  ]);
  const card = el('div', { style: { background: 'var(--bg-2)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', padding: '18px 16px calc(env(safe-area-inset-bottom) + 16px)', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow)' } });
  function render() {
    card.replaceChildren(
      el('div', { class: 'grabber', style: { width: '40px', height: '4px', background: 'var(--line-2)', borderRadius: '2px', margin: '0 auto 12px' } }),
      el('h3', { style: { margin: '0 0 12px' } }, 'Edit exercise'),
      stepper('Sets', 'sets', 1, 10, 1),
      stepper('Min reps', 'repLow', 1, 50, 1),
      stepper('Max reps', 'repHigh', 1, 60, 1),
      stepper('Rest (seconds)', 'restSec', 15, 300, 15),
      el('div', { class: 'row-flex', style: { gap: '8px', marginTop: '8px' } }, [
        el('button', { class: 'btn ghost', style: { flex: 1 }, onclick: () => back.remove() }, 'Cancel'),
        el('button', { class: 'btn primary lg', style: { flex: 1 }, onclick: () => {
          draft.repHigh = Math.max(draft.repLow, draft.repHigh);
          onSave(draft); back.remove();
        } }, 'Save'),
      ]),
    );
  }
  render();
  back.appendChild(card);
  back.addEventListener('click', e => { if (e.target === back) back.remove(); });
  document.body.appendChild(back);
}
