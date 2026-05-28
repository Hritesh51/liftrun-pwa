// Hand-rolled SVG charts. Zero dependencies; works offline.
import { el } from './util.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/**
 * @param {string} name
 * @param {Record<string, any>} [attrs]
 * @param {any} [children]
 * @returns {SVGElement}
 */
function svg(name, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, String(v));
  for (const child of [].concat(children)) if (child) node.appendChild(child);
  return node;
}

export function lineChart(points, { units = 'kg' } = {}) {
  const W = 360, H = 160, padL = 28, padR = 8, padT = 12, padB = 22;
  if (!points || points.length === 0) {
    return el('div', { class: 'muted' }, 'No data yet.');
  }
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const xRange = xmax - xmin || 1;
  const yRange = (ymax - ymin) || 1;
  const sx = (x) => padL + ((x - xmin) / xRange) * (W - padL - padR);
  const sy = (y) => H - padB - ((y - ymin) / yRange) * (H - padT - padB);

  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  const areaPath = `${path} L ${sx(xmax).toFixed(1)} ${H - padB} L ${sx(xmin).toFixed(1)} ${H - padB} Z`;

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', preserveAspectRatio: 'none', role: 'img' });
  const min = formatY(ymin, units), max = formatY(ymax, units);
  const titleEl = svg('title'); titleEl.textContent = `Trend chart: ${points.length} points, from ${min} to ${max}`; root.appendChild(titleEl);
  // Gridlines (3)
  for (let i = 0; i <= 3; i++) {
    const y = padT + (H - padT - padB) * (i / 3);
    root.appendChild(svg('line', { class: 'gridline', x1: padL, x2: W - padR, y1: y, y2: y }));
  }
  // Axes
  root.appendChild(svg('line', { class: 'axis', x1: padL, y1: H - padB, x2: W - padR, y2: H - padB }));
  // Area + line
  root.appendChild(svg('path', { class: 'area', d: areaPath }));
  root.appendChild(svg('path', { class: 'line', d: path }));
  // End dot
  const last = points[points.length - 1];
  root.appendChild(svg('circle', { class: 'dot', cx: sx(last.x), cy: sy(last.y), r: 3 }));
  // Y labels (min/max)
  const lblMin = svg('text', { x: 4, y: H - padB }); lblMin.textContent = formatY(ymin, units); root.appendChild(lblMin);
  const lblMax = svg('text', { x: 4, y: padT + 8 }); lblMax.textContent = formatY(ymax, units); root.appendChild(lblMax);
  // X labels (first/last)
  const first = svg('text', { x: padL, y: H - 4 }); first.textContent = new Date(xmin).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); root.appendChild(first);
  const lastX = svg('text', { x: W - padR - 50, y: H - 4 }); lastX.textContent = new Date(xmax).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); root.appendChild(lastX);

  return root;
}

function formatY(v, units) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return Math.round(v) + '';
}

export function barChart(items, { color = '#ff6438' } = {}) {
  const W = 360, H = 160, padL = 60, padR = 8, padT = 8, padB = 20;
  if (!items || !items.length) return el('div', { class: 'muted' }, 'No data yet.');
  const max = Math.max(1, ...items.map(it => it.value));
  const rowH = (H - padT - padB) / items.length;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', preserveAspectRatio: 'none', role: 'img' });
  const t = svg('title'); t.textContent = 'Bar chart: ' + items.map(it => `${it.label} ${Math.round(it.value)}`).join(', '); root.appendChild(t);
  items.forEach((it, i) => {
    const y = padT + i * rowH + 2;
    const h = Math.max(8, rowH - 4);
    const w = ((it.value / max) * (W - padL - padR));
    const t = svg('text', { x: padL - 8, y: y + h * 0.7, 'text-anchor': 'end' });
    t.textContent = it.label;
    root.appendChild(t);
    root.appendChild(svg('rect', { class: 'bar', x: padL, y, width: w, height: h, rx: 3 }));
    const v = svg('text', { x: padL + w + 4, y: y + h * 0.7 });
    v.textContent = String(Math.round(it.value));
    root.appendChild(v);
  });
  return root;
}

export function calendarHeatmap(cells) {
  // 7-col grid; cells: [{date, day, status, hasRun}, ...] for last N days
  const root = el('div', { class: 'cal' });
  // Pad start so weeks line up — first cell starts at correct weekday position.
  if (!cells.length) return root;
  const firstDay = cells[0].day; // 0=Sun
  for (let i = 0; i < firstDay; i++) root.appendChild(el('div', { class: 'cell', style: { background: 'transparent' } }));
  for (const c of cells) {
    const cls = `cell ${c.status === 'done' ? 'done' : c.status === 'rest' ? 'rest' : c.status === 'partial' ? 'partial' : ''}`;
    root.appendChild(el('div', { class: cls, title: c.date }, [
      el('span', { class: 'd' }, String(new Date(c.date).getDate())),
    ]));
  }
  return root;
}
