// Small helpers shared across the app.
/**
 * @param {string} sel
 * @param {ParentNode} [root]
 * @returns {any}
 */
export const $  = (sel, root = document) => root.querySelector(sel);
/**
 * @param {string} sel
 * @param {ParentNode} [root]
 * @returns {any[]}
 */
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * A child accepted by {@link el}: text, a node, a falsy placeholder, or a (nested) array of these.
 * @typedef {string | number | Node | false | null | undefined | any[]} ElChild
 */

/**
 * Create a DOM element with attributes and children.
 * `class`, `style` (object), `on*` handlers, `html`, `dataset` and boolean attrs are special-cased.
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {ElChild} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const child of kids) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
  return node;
}

export function fmtDate(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
export function fmtTime(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export function dayKey(d = new Date()) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
export function daysBetween(a, b) {
  const ms = new Date(dayKey(b)).getTime() - new Date(dayKey(a)).getTime();
  return Math.round(ms / 86400000);
}
export function isoNow() { return new Date().toISOString(); }
export function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

export function kgToLb(kg) { return kg * 2.20462; }
export function lbToKg(lb) { return lb / 2.20462; }
export function roundTo(value, step) { return Math.round(value / step) * step; }
export function fmtWeight(kg, units = 'kg') {
  if (kg == null || isNaN(kg)) return '—';
  if (units === 'lb') return `${(Math.round(kgToLb(kg) * 2) / 2).toFixed(1).replace(/\.0$/, '')} lb`;
  return `${(Math.round(kg * 2) / 2).toFixed(1).replace(/\.0$/, '')} kg`;
}
export function fmtPace(secPerKm, units = 'kg') {
  if (!secPerKm || !isFinite(secPerKm)) return '—';
  let v = secPerKm;
  if (units === 'lb') v = secPerKm * 1.60934; // sec/mi
  const m = Math.floor(v / 60), s = Math.round(v % 60);
  return `${m}:${String(s).padStart(2, '0')}/${units === 'lb' ? 'mi' : 'km'}`;
}
export function fmtDistance(m, units = 'kg') {
  if (m == null) return '—';
  return units === 'lb'
    ? `${(m / 1609.344).toFixed(2)} mi`
    : `${(m / 1000).toFixed(2)} km`;
}
export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

// Toast queue — FIFO. Multiple rapid toasts no longer overwrite each other.
/** @typedef {{ label: string, fn: () => void }} ToastAction */
/** @type {Array<{ msg: string, type: string, action: ToastAction|null }>} */
const toastQueue = [];
let toastShowing = false;
/**
 * @param {string} msg
 * @param {string} [type]
 * @param {ToastAction|null} [action]
 */
export function toast(msg, type = '', action = null) {
  toastQueue.push({ msg, type, action });
  if (!toastShowing) drainToasts();
}
function drainToasts() {
  const item = toastQueue.shift();
  if (!item) { toastShowing = false; return; }
  toastShowing = true;
  const { msg, type, action } = item;
  const t = $('#toast');
  if (!t) { toastShowing = false; return; }
  t.replaceChildren();
  t.appendChild(document.createTextNode(msg));
  if (action) {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.style.cssText = 'margin-left:10px;background:transparent;border:0;color:var(--accent);font-weight:700;cursor:pointer;font-size:14px';
    btn.onclick = () => { try { action.fn(); } catch {} t.className = 'toast'; };
    t.appendChild(btn);
  }
  t.className = `toast show ${type}`;
  const dur = action ? 4200 : 2200;
  setTimeout(() => {
    t.className = 'toast';
    setTimeout(drainToasts, 200);
  }, dur);
}

// Haptic vocabulary. iOS Web supports basic patterns via vibrate(). We map intent → pattern.
export const haptic = Object.assign(
  function haptic(kind = 'light') {
    if (!navigator.vibrate) return;
    const map = {
      light:    8,
      medium:   14,
      heavy:    [20, 20, 20],
      success:  [10, 30, 10],
      warning:  [20, 50, 20],
      error:    [40, 30, 40, 30, 40],
      pr:       [12, 40, 12, 40, 60],
      timer:    [40, 60, 40],
      select:   6,
      tap:      4,
    };
    try { navigator.vibrate(map[kind] || 10); } catch {}
  },
  {
    success: () => haptic('success'),
    warning: () => haptic('warning'),
    error:   () => haptic('error'),
    pr:      () => haptic('pr'),
    tap:     () => haptic('tap'),
    select:  () => haptic('select'),
  }
);

// Defensive JSON parse — strips ``` fences, finds the first {...} or [...] block, fixes trailing commas, retries on fail.
export function parseJsonLoose(s) {
  if (s == null) return null;
  let text = String(s).trim();
  text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
  const tryParse = (t) => { try { return JSON.parse(t); } catch { return undefined; } };
  const stripTrailing = (t) => t.replace(/,(\s*[}\]])/g, '$1');
  let v = tryParse(text); if (v !== undefined) return v;
  v = tryParse(stripTrailing(text)); if (v !== undefined) return v;
  const objMatch = text.match(/\{[\s\S]*\}/);
  const arrMatch = text.match(/\[[\s\S]*\]/);
  const candidate = objMatch && arrMatch
    ? ((objMatch.index ?? 0) < (arrMatch.index ?? 0) ? objMatch[0] : arrMatch[0])
    : (objMatch?.[0] || arrMatch?.[0]);
  if (!candidate) return null;
  v = tryParse(candidate); if (v !== undefined) return v;
  v = tryParse(stripTrailing(candidate)); if (v !== undefined) return v;
  return null;
}

// Safe replaceChildren — filters null/undefined/false/empty strings (which
// Element.replaceChildren would otherwise coerce to literal "null" text nodes).
export function mount(parent, ...children) {
  const safe = [];
  const flatten = (x) => {
    if (x == null || x === false || x === true) return;
    if (Array.isArray(x)) { for (const i of x) flatten(i); return; }
    safe.push(x);
  };
  for (const c of children) flatten(c);
  parent.replaceChildren(...safe);
}

// Tiny event bus
const listeners = new Map();
export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}
export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of set) { try { fn(payload); } catch (e) { console.error(e); } }
}

// e1RM — Epley formula, conservative.
export function e1RM(weight, reps) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// Clamp + linear interp helpers
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
