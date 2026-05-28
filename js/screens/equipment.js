// Equipment profile + training-mode + home-program picker sheet.
import { el, toast, haptic } from '../util.js';
import * as S from '../state.js';
import { EQUIPMENT, HOME_PROGRAMS } from '../home-data.js';
import { equipmentCoverage, availableLadder } from '../home.js';

export function renderEquipmentSheet(sheetBody, ctx, router) {
  redraw();
  function redraw() {
    const s = S.get();
    const cov = equipmentCoverage();
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Home setup'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, 'Tell the app what you have. Workouts use only your equipment and progress you through difficulty ladders — no plates needed.'),

      // Training mode
      el('div', { class: 'card flat' }, [
        el('div', { class: 'eyebrow' }, ['Where do you train?']),
        el('div', { class: 'row-flex', style: { marginTop: '8px' } }, [
          el('button', { class: `btn ${s.trainingMode === 'gym' ? 'primary' : ''}`, style: { flex: 1 }, onclick: () => { S.setTrainingMode('gym'); haptic('select'); redraw(); } }, '🏋️ Gym'),
          el('button', { class: `btn ${s.trainingMode === 'home' ? 'primary' : ''}`, style: { flex: 1 }, onclick: () => { S.setTrainingMode('home'); haptic('select'); redraw(); } }, '🏠 Home'),
        ]),
        el('p', { class: 'faint', style: { margin: '6px 0 0' } }, s.trainingMode === 'home'
          ? `Home mode active — Today + Program now use your home plan (${cov.covered}/${cov.total} movement patterns trainable).`
          : 'Gym mode — full PPL / bro split with machines + barbells.'),
      ]),

      // Equipment checklist
      el('div', { class: 'card flat' }, [
        el('div', { class: 'eyebrow' }, ['My equipment']),
        el('div', { class: 'list' }, EQUIPMENT.map(eq => {
          const owned = eq.always || s.equipment?.[eq.id];
          return el('div', { class: 'toggle' }, [
            el('div', { class: 'label' }, [eq.label, eq.always ? el('span', { class: 'faint', style: { marginLeft: '6px' } }, '(always)') : null]),
            eq.always
              ? el('span', { class: 'pill good' }, '✓')
              : el('button', { class: 'switch', 'aria-checked': String(!!owned), onclick: (e) => {
                  S.setEquipment(eq.id, !owned);
                  e.currentTarget.setAttribute('aria-checked', String(!owned));
                  haptic('tap');
                  redraw();
                } }),
          ]);
        })),
      ]),

      // Home program picker (only relevant in home mode)
      s.trainingMode === 'home' ? el('div', { class: 'card flat' }, [
        el('div', { class: 'eyebrow' }, ['Home program']),
        el('div', { style: { marginTop: '8px' } }, Object.values(HOME_PROGRAMS).map(p => el('button', {
          class: `btn block ${s.homeProgramId === p.id ? 'primary' : ''}`,
          style: { marginBottom: '6px', justifyContent: 'space-between' },
          onclick: () => { S.setHomeProgram(p.id); toast(`${p.name} selected`); haptic('select'); redraw(); },
        }, [
          el('span', {}, p.name),
          el('span', { class: 'faint', style: { fontWeight: 400 } }, `${p.days.filter(d => d.slots.length).length} training days`),
        ]))),
        el('p', { class: 'faint' }, 'Full Body ×3 is best for beginners or minimal equipment. PPL needs a pull-up bar + dumbbells/bands.'),
      ]) : null,

      // Coverage hint
      cov.covered < cov.total ? el('div', { class: 'card flat', style: { borderColor: 'var(--warn)' } }, [
        el('p', { class: 'muted', style: { margin: 0 } }, `${cov.total - cov.covered} movement pattern(s) need more equipment to train fully. A pull-up bar + bands unlock almost everything.`),
      ]) : null,

      el('button', { class: 'btn primary block lg', onclick: () => { router.closeSheet(); router.refresh(); } }, 'Done'),
    );
  }
}
