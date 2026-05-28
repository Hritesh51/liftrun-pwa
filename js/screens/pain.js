import { el, toast, haptic, fmtDate } from '../util.js';
import * as S from '../state.js';
import { substitutionsFor } from '../engine.js';

const ZONES = [
  { id: 'neck',     label: 'Neck',     cx: 50, cy: 12, r: 6 },
  { id: 'shoulder-l', label: 'Left shoulder',  cx: 36, cy: 24, r: 6 },
  { id: 'shoulder-r', label: 'Right shoulder', cx: 64, cy: 24, r: 6 },
  { id: 'chest',    label: 'Chest',    cx: 50, cy: 30, r: 7 },
  { id: 'upper-back', label: 'Upper back', cx: 50, cy: 30, r: 7, back: true },
  { id: 'elbow-l',  label: 'Left elbow',  cx: 26, cy: 36, r: 4 },
  { id: 'elbow-r',  label: 'Right elbow', cx: 74, cy: 36, r: 4 },
  { id: 'lower-back', label: 'Lower back', cx: 50, cy: 44, r: 7, back: true },
  { id: 'abs',      label: 'Abs',      cx: 50, cy: 42, r: 6 },
  { id: 'hip-l',    label: 'Left hip',  cx: 42, cy: 52, r: 5 },
  { id: 'hip-r',    label: 'Right hip', cx: 58, cy: 52, r: 5 },
  { id: 'wrist-l',  label: 'Left wrist',  cx: 20, cy: 46, r: 3 },
  { id: 'wrist-r',  label: 'Right wrist', cx: 80, cy: 46, r: 3 },
  { id: 'knee-l',   label: 'Left knee',  cx: 44, cy: 70, r: 5 },
  { id: 'knee-r',   label: 'Right knee', cx: 56, cy: 70, r: 5 },
  { id: 'ankle-l',  label: 'Left ankle',  cx: 44, cy: 88, r: 4 },
  { id: 'ankle-r',  label: 'Right ankle', cx: 56, cy: 88, r: 4 },
];

export function renderPainSheet(sheetBody, ctx, router) {
  let view = 'front'; // 'front' | 'back'
  let selected = null;
  const draft = { severity: 3, note: '', withMovement: '' };

  redraw();

  function redraw() {
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Log a twinge'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, 'Tap where it hurts. Sharp / persistent pain → stop and see a professional.'),

      el('div', { class: 'row-flex', style: { margin: '8px 0' } }, [
        el('button', { class: `btn sm ${view === 'front' ? 'primary' : ''}`, onclick: () => { view = 'front'; redraw(); } }, 'Front'),
        el('button', { class: `btn sm ${view === 'back' ? 'primary' : ''}`, onclick: () => { view = 'back'; redraw(); } }, 'Back'),
      ]),

      renderDiagram(),

      selected ? renderForm() : el('p', { class: 'faint', style: { marginTop: '8px' } }, 'Tap a body part above.'),

      renderHistory(),
    );
  }

  function renderDiagram() {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '300');
    svg.style.background = 'var(--bg-3)';
    svg.style.borderRadius = '12px';

    // Body outline (very simplified)
    const body = document.createElementNS(SVG_NS, 'path');
    body.setAttribute('d', view === 'front'
      ? 'M50 4 a8 8 0 0 1 0 16 L46 22 L34 26 L30 36 L26 50 L24 62 L26 76 L28 96 L40 96 L42 80 L46 60 L50 60 L54 60 L58 80 L60 96 L72 96 L74 76 L76 62 L74 50 L70 36 L66 26 L54 22 z'
      : 'M50 4 a8 8 0 0 0 0 16 L46 22 L34 26 L30 36 L26 50 L24 62 L26 76 L28 96 L40 96 L42 80 L46 60 L50 60 L54 60 L58 80 L60 96 L72 96 L74 76 L76 62 L74 50 L70 36 L66 26 L54 22 z');
    body.setAttribute('fill', 'var(--bg-2)');
    body.setAttribute('stroke', 'var(--line-2)');
    body.setAttribute('stroke-width', '0.5');
    svg.appendChild(body);

    // Zones
    for (const z of ZONES) {
      if (!!z.back !== (view === 'back')) continue;
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', String(z.cx));
      c.setAttribute('cy', String(z.cy));
      c.setAttribute('r', String(z.r));
      c.setAttribute('fill', selected?.id === z.id ? 'var(--accent)' : 'rgba(255,100,56,.25)');
      c.setAttribute('stroke', selected?.id === z.id ? 'var(--accent)' : 'rgba(255,100,56,.5)');
      c.setAttribute('stroke-width', '0.5');
      c.style.cursor = 'pointer';
      c.addEventListener('click', () => { selected = z; haptic('light'); redraw(); });
      svg.appendChild(c);
    }
    return svg;
  }

  function renderForm() {
    return el('div', { class: 'card flat', style: { marginTop: '12px' } }, [
      el('h3', {}, selected.label),
      el('div', { class: 'field' }, [
        el('label', {}, [`Severity: `, el('strong', {}, ['None','Mild','Moderate','Bad','Severe'][draft.severity - 1])]),
        el('div', { class: 'row-flex' }, [1,2,3,4,5].map(v => el('button', {
          class: `btn ${draft.severity === v ? 'primary' : ''} sm`, style: { flex: 1 },
          onclick: () => { draft.severity = v; haptic('light'); redraw(); },
        }, String(v)))),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'During / after which movement? (optional)'),
        el('input', { type: 'text', placeholder: 'e.g. chest press, RDL, running', value: draft.withMovement, oninput: e => draft.withMovement = e.target.value }),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Notes'),
        el('textarea', { rows: 2, placeholder: 'sharp, dull, only on lockout…', oninput: e => draft.note = e.target.value }, draft.note),
      ]),
      draft.severity >= 4 ? el('p', { class: 'faint', style: { color: 'var(--warn)' } }, '⚠️ Severity 4–5 — stop that movement today. If sharp or persistent, see a qualified professional (physio/doctor).') : null,
      el('button', { class: 'btn primary block lg', onclick: save }, 'Save'),
    ]);
  }

  function renderHistory() {
    const s = S.get();
    if (!s.painLog?.length) return el('p', { class: 'faint', style: { marginTop: '16px' } }, 'No twinges logged yet.');
    return el('div', { class: 'card flat', style: { marginTop: '12px' } }, [
      el('div', { class: 'eyebrow' }, ['Recent']),
      el('div', { class: 'list' }, s.painLog.slice(0, 10).map(p => el('div', { class: 'list-item' }, [
        el('div', {}, [
          el('div', { style: { fontWeight: 600 } }, `${p.bodyPart} · ${'★'.repeat(p.severity)}`),
          el('div', { class: 'faint' }, `${fmtDate(p.date)}${p.withMovement ? ' · ' + p.withMovement : ''}${p.note ? ' · ' + p.note : ''}`),
        ]),
        p.status === 'resolved'
          ? el('span', { class: 'pill good' }, '✓')
          : el('button', { class: 'btn sm ghost', onclick: () => { S.resolvePain(p.id); toast('Marked resolved'); redraw(); } }, 'Resolved'),
      ]))),
    ]);
  }

  function save() {
    if (!selected) return;
    haptic('medium');
    try {
      S.logPain({
        bodyPart: selected.label,
        bodyPartId: selected.id,
        severity: draft.severity,
        withMovement: draft.withMovement || null,
        note: draft.note || null,
        status: 'active',
      });
    } catch (err) {
      toast(/** @type {any} */ (err)?.message, 'error');
      return;
    }
    toast('Logged — stay smart out there', draft.severity >= 4 ? 'error' : 'success');
    router.closeSheet();
    router.refresh();
  }
}
