// Bottom-sheet content for readiness check-in + add-exercise picker.
import { el, toast, haptic } from '../util.js';
import * as S from '../state.js';
import { readinessAdvice } from '../engine.js';
import { EXERCISES } from '../seed.js';

export function renderReadiness(sheetBody, router) {
  const initial = { sleep: 3, soreness: 3, energy: 3, pain: false, painSite: '' };
  const state = { ...initial };
  redraw();
  function redraw() {
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Quick check-in'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, '10 seconds. Helps the app scale the session if you\'re cooked.'),
      slider('Sleep', 'sleep'),
      slider('Soreness', 'soreness', true),
      slider('Energy', 'energy'),
      el('div', { class: 'toggle' }, [
        el('div', { class: 'label' }, 'Any sharp pain?'),
        el('button', { class: 'switch', 'aria-checked': String(state.pain), onclick: () => { state.pain = !state.pain; redraw(); } }),
      ]),
      state.pain ? el('div', { class: 'field' }, [
        el('label', {}, 'Where?'),
        el('input', { type: 'text', placeholder: 'shoulder, lower back…', value: state.painSite, oninput: (e) => state.painSite = e.target.value }),
        el('p', { class: 'faint' }, 'For sharp or persistent pain, please see a qualified professional.'),
      ]) : null,
      el('button', { class: 'btn primary block lg', onclick: () => save() }, 'Save check-in'),
    );
  }
  function slider(label, key, inverted = false) {
    return el('div', { class: 'field' }, [
      el('label', {}, [`${label}: `, el('strong', {}, ['Awful','Bad','OK','Good','Great'][state[key] - 1])]),
      el('div', { class: 'row-flex' }, [1,2,3,4,5].map(v => el('button', {
        class: `btn ${state[key] === v ? 'primary' : ''} sm`, style: { flex: 1 },
        onclick: () => { state[key] = v; haptic('light'); redraw(); },
      }, String(v)))),
    ]);
  }
  function save() {
    const score = (state.sleep - 1) * 12.5 + (state.energy - 1) * 12.5 - (state.soreness - 1) * 12.5 + 50;
    const advice = readinessAdvice(Math.max(0, Math.min(100, Math.round(score))), state.pain);
    S.logReadiness({ ...state, score: Math.round(score) });
    toast(advice.mode === 'go' ? 'Locked in. Train hard.' : advice.mode === 'pain' ? 'Take care today.' : 'Adjusted: ' + advice.mode);
    router.closeSheet();
    router.refresh();
  }
}

export function renderAddExercise(sheetBody, ctx, router) {
  const { weekType, dayIndex } = ctx;
  let q = '';
  redraw();
  function redraw() {
    const filt = EXERCISES.filter(e => !q || e.name.toLowerCase().includes(q) || e.primary.toLowerCase().includes(q));
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 8px' } }, 'Add exercise'),
      el('input', { type: 'search', placeholder: 'Search…', oninput: (e) => { q = e.target.value.toLowerCase(); redraw(); }, style: { width: '100%', marginBottom: '8px' } }),
      el('div', { class: 'list', style: { maxHeight: '60vh', overflowY: 'auto' } }, filt.map(e => el('div', { class: 'list-item' }, [
        el('div', {}, [el('div', { style: { fontWeight: 600 } }, e.name), el('div', { class: 'faint' }, `${e.primary}${e.secondary.length ? ' · ' + e.secondary.join(', ') : ''}`)]),
        el('button', { class: 'btn sm primary', onclick: () => {
          S.update(s => {
            const day = s.programs[weekType].days[Number(dayIndex)];
            day.slots.push({ exerciseId: e.id, sets: 3, repLow: 10, repHigh: 12, restSec: 90 });
          });
          toast('Added');
          router.closeSheet();
          router.refresh();
        } }, 'Add'),
      ]))),
    );
  }
}
