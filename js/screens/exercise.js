import { el, fmtDate, fmtWeight, e1RM } from '../util.js';
import * as S from '../state.js';
import { e1RMSeries, substitutionsFor } from '../engine.js';
import { lineChart } from '../charts.js';
import { exerciseDemo } from '../ui.js';

export function render(view, router, params) {
  const ex = S.getExercise(params.id);
  if (!ex) { view.replaceChildren(el('div', { class: 'card' }, 'Exercise not found.')); return; }
  const units = S.get().settings.units;
  const series = e1RMSeries(ex.id);
  const subs = substitutionsFor(ex.id);
  const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' form')}`;

  view.replaceChildren(el('div', {}, [
    el('div', { class: 'h-row' }, [
      el('button', { class: 'btn icon', onclick: () => history.back() }, [
        el('span', { html: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>' }),
      ]),
      el('h1', { style: { flex: 1, fontSize: '22px' } }, ex.name),
    ]),
    // Animated demonstration — loops the start/end frames like a short video.
    ex.imageUrl ? el('div', { class: 'card', style: { padding: '8px' } }, [
      exerciseDemo(ex, { maxHeight: '320px' }),
    ]) : null,

    // Targets — which muscles this trains (primary highlighted).
    el('div', { class: 'card flat' }, [
      el('div', { class: 'eyebrow' }, ['Targets']),
      el('div', { class: 'row-flex', style: { marginTop: '8px' } }, [
        ex.primary ? el('span', { class: 'pill accent' }, ex.primary) : null,
        ...((ex.secondary || []).map(m => el('span', { class: 'pill' }, m))),
      ]),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Form cues']),
      el('ul', { style: { margin: '8px 0 0', paddingLeft: '20px', lineHeight: 1.5 } }, ex.cues.map(c => el('li', {}, c))),
      el('div', { class: 'row-flex', style: { marginTop: '12px' } }, [
        el('a', { href: ytSearch, target: '_blank', rel: 'noopener', class: 'btn sm' }, 'Watch demo ↗'),
        el('button', { class: 'btn sm primary', onclick: () => router.openSheet('formReview', { exerciseId: ex.id }) }, 'AI form review'),
      ]),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['e1RM trend']),
      series.length > 1
        ? lineChart(series.map(p => ({ x: new Date(p.date).getTime(), y: p.e1 })), { units })
        : el('p', { class: 'muted' }, 'Log a few sessions to see a trend.'),
    ]),
    subs.length ? el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Substitutions']),
      el('div', { class: 'list' }, subs.map(s => el('div', { class: 'list-item' }, [
        el('div', {}, [el('div', { style: { fontWeight: 600 } }, s.name), el('div', { class: 'faint' }, s.primary)]),
        el('button', { class: 'btn sm', onclick: () => router.go(`exercise/${s.id}`) }, 'Open'),
      ]))),
    ]) : null,
  ]));
}

export function renderSwapSheet(sheetBody, ctx, router) {
  const subs = substitutionsFor(ctx.exerciseId);
  const all = [...subs];
  // Add other library options grouped by primary muscle
  sheetBody.replaceChildren(
    el('div', { class: 'grabber' }),
    el('h2', { style: { margin: '0 0 8px' } }, 'Swap exercise'),
    el('p', { class: 'muted', style: { marginTop: 0 } }, 'Quick alternatives that train the same muscle.'),
    el('div', { class: 'list' }, all.length ? all.map(s => el('div', { class: 'list-item' }, [
      el('div', {}, [el('div', { style: { fontWeight: 600 } }, s.name), el('div', { class: 'faint' }, s.primary)]),
      el('button', { class: 'btn sm primary', onclick: () => { ctx.onSwap(s.id); router.closeSheet(); } }, 'Use'),
    ])) : [el('div', { class: 'muted' }, 'No subs registered.')]),
    el('div', { class: 'spacer' }),
    el('h3', {}, 'All exercises'),
    el('div', { class: 'list' }, S.allExercises().filter(e => e.id !== ctx.exerciseId).map(e => el('div', { class: 'list-item' }, [
      el('div', {}, [el('div', { style: { fontWeight: 600 } }, e.name), el('div', { class: 'faint' }, e.primary)]),
      el('button', { class: 'btn sm', onclick: () => { ctx.onSwap(e.id); router.closeSheet(); } }, 'Use'),
    ]))),
  );
}
