import { el, haptic, toast } from '../util.js';
import * as S from '../state.js';
import { setStartDate } from '../engine.js';

export function render(view, router) {
  const s = S.get();
  const wrap = el('div', { class: 'welcome' }, [
    el('div', { class: 'logo' }, [
      el('div', { html: `<svg viewBox="0 0 50 50" aria-hidden="true">
        <rect x="3" y="22" width="44" height="6" rx="1" fill="#ff6438"/>
        <rect x="22" y="15" width="6" height="20" rx="1" fill="#ff6438"/>
        <rect x="0" y="18" width="3" height="14" rx="1" fill="#e8ecef"/>
        <rect x="47" y="18" width="3" height="14" rx="1" fill="#e8ecef"/>
      </svg>` }),
    ]),
    el('h1', {}, 'LiftRun'),
    el('p', { class: 'muted' }, 'Personal Push/Pull/Legs + running. Logs sets fast. Coaches you between them.'),
    el('div', { class: 'card', style: { width: '100%', textAlign: 'left', marginTop: '16px' } }, [
      el('h3', {}, 'Quick setup'),
      el('div', { class: 'field' }, [
        el('label', { for: 'unitSel' }, 'Units'),
        el('select', { id: 'unitSel', onchange: (e) => S.setSetting('units', e.target.value) }, [
          el('option', { value: 'kg', selected: s.settings.units === 'kg' }, 'kg / km (metric)'),
          el('option', { value: 'lb', selected: s.settings.units === 'lb' }, 'lb / mi (imperial)'),
        ]),
      ]),
      el('div', { class: 'field' }, [
        el('label', { for: 'startSel' }, 'When are you starting?'),
        el('select', { id: 'startSel' }, [
          el('option', { value: 'today' }, 'Today (Day 1: Push)'),
          el('option', { value: 'tomorrow', selected: true }, 'Tomorrow (Day 1: Push)'),
        ]),
      ]),
      el('div', { class: 'field' }, [
        el('label', { for: 'bwIn' }, `Your weight (${s.settings.units})`),
        el('input', { id: 'bwIn', type: 'number', step: '0.1', placeholder: s.settings.units === 'lb' ? '139' : '63' }),
      ]),
    ]),
    el('button', { class: 'btn primary block lg', onclick: finish }, 'Start'),
    el('p', { class: 'faint', style: { padding: '0 16px' } }, 'Everything is stored on your phone. The AI coach is optional and uses your own API key.'),
  ]);
  view.replaceChildren(wrap);

  function finish() {
    haptic('medium');
    const when = /** @type {HTMLSelectElement} */ (document.getElementById('startSel')).value;
    const date = new Date();
    if (when === 'tomorrow') date.setDate(date.getDate() + 1);
    setStartDate(date);
    const bw = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('bwIn')).value);
    if (bw && !isNaN(bw)) {
      const kg = S.get().settings.units === 'lb' ? bw / 2.20462 : bw;
      S.logBody({ weightKg: kg });
      S.update(s => { s.user.startingWeightKg = kg; });
    }
    S.update(s => { s.user.onboarded = true; });
    toast('You\'re set. Day 1 is Push.', 'success');
    router.go('today');
  }
}
