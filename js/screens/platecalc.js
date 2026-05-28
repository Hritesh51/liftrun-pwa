import { el, haptic, toast, kgToLb, lbToKg } from '../util.js';
import * as S from '../state.js';
import { plateBreakdown, closestAchievable, DEFAULT_PLATES_KG, DEFAULT_PLATES_LB, DEFAULT_BAR_KG, DEFAULT_BAR_LB } from '../platecalc.js';

export function renderPlateCalcSheet(sheetBody, ctx, router) {
  const units = S.get().settings.units;
  const defaultBar = units === 'lb' ? DEFAULT_BAR_LB : DEFAULT_BAR_KG;
  const defaultPlates = units === 'lb' ? DEFAULT_PLATES_LB : DEFAULT_PLATES_KG;
  let target = ctx?.initialTarget ?? defaultBar + 20;
  let bar = defaultBar;

  redraw();

  function redraw() {
    const plates = defaultPlates;
    const br = closestAchievable(target, bar, plates);
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Plate calculator'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, `Bar: ${bar} ${units} · Standard inventory.`),

      el('div', { class: 'field' }, [
        el('label', {}, `Target loaded weight (${units})`),
        el('div', { class: 'stepper', style: { maxWidth: '220px' } }, [
          el('button', { type: 'button', onclick: () => { target = Math.max(bar, target - 2.5); redraw(); } }, '–'),
          el('input', { type: 'number', step: '2.5', value: String(target), oninput: e => target = parseFloat(e.target.value) || bar, onchange: redraw }),
          el('button', { type: 'button', onclick: () => { target += 2.5; redraw(); } }, '+'),
        ]),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, `Bar weight (${units})`),
        el('input', { type: 'number', step: '0.5', value: String(bar), oninput: e => bar = parseFloat(e.target.value) || defaultBar, onchange: redraw }),
      ]),

      renderBarVisual(br, units),

      el('div', { class: 'card flat', style: { marginTop: '12px' } }, [
        el('div', { class: 'eyebrow' }, ['Per side']),
        br.perSidePlates?.length
          ? el('div', { class: 'row-flex' }, br.perSidePlates.map(p => el('span', { class: 'pill accent' }, `${p}${units}`)))
          : el('span', { class: 'muted' }, 'Just the bar.'),
        (br.leftover ?? 0) > 0.1 ? el('p', { class: 'faint warn' }, `Closest possible — ${br.leftover}${units} short per side.`) : null,
      ]),
      el('button', { class: 'btn block', onclick: () => router.closeSheet() }, 'Done'),
    );
  }
}

function renderBarVisual(br, units) {
  if (!br.feasible) {
    return el('div', { class: 'card flat' }, el('p', { class: 'muted' }, 'Target below bar weight.'));
  }
  const plates = br.perSidePlates || [];
  const plateColors = { 25: '#ef4444', 20: '#3b82f6', 15: '#fbbf24', 10: '#22c55e', 5: '#e5e7eb', 2.5: '#9ca3af', 1.25: '#6b7280', 0.5: '#374151', 45: '#3b82f6', 35: '#fbbf24' };
  const stack = (side) => el('div', { style: { display: 'flex', flexDirection: side === 'left' ? 'row-reverse' : 'row', alignItems: 'center', gap: '2px' } },
    plates.map(p => el('div', {
      style: {
        width: `${Math.max(8, p * 0.6 + 8)}px`,
        height: `${30 + Math.min(40, p * 1.5)}px`,
        background: plateColors[p] || '#9ca3af',
        borderRadius: '2px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', fontWeight: 700, color: '#0b0d10',
      },
    }, String(p))));
  return el('div', { class: 'card flat', style: { marginTop: '12px' } }, [
    el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0' } }, [
      stack('left'),
      el('div', { style: { height: '8px', background: '#9ca3af', flex: 1, maxWidth: '50px', margin: '0 4px' } }),
      el('div', { style: { width: '12px', height: '36px', background: '#d1d5db', borderRadius: '2px', margin: '0 2px' } }),
      el('div', { style: { height: '8px', background: '#9ca3af', flex: 1, maxWidth: '50px', margin: '0 4px' } }),
      stack('right'),
    ]),
    el('p', { class: 'center muted', style: { marginTop: '8px', fontSize: '13px' } }, `Total: ${br.targetWeight}${units}`),
  ]);
}
