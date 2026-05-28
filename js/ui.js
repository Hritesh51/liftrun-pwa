// World-class UI primitives: inline confirm, skeleton loader, photo lightbox, lightweight markdown.
import { el, toast, haptic } from './util.js';

// ---------------- Inline confirm ----------------
// Replaces `window.confirm()` with a styled inline prompt that requires double-tap to confirm.
// Returns a Promise<boolean>.
export function confirmAction({ title = 'Are you sure?', body = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = true } = {}) {
  return new Promise((resolve) => {
    const back = el('div', { style: { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.55)', zIndex: '300', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } });
    const card = el('div', {
      style: {
        background: 'var(--bg-2)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
        padding: '18px 16px calc(env(safe-area-inset-bottom) + 16px)',
        width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow)',
        transform: 'translateY(20px)', transition: 'transform .25s cubic-bezier(.2,.8,.2,1)',
      },
    }, [
      el('div', { class: 'grabber', style: { width: '40px', height: '4px', background: 'var(--line-2)', borderRadius: '2px', margin: '0 auto 12px' } }),
      el('h3', { style: { margin: '0 0 6px' } }, title),
      body ? el('p', { class: 'muted', style: { margin: '0 0 16px' } }, body) : null,
      el('div', { class: 'row-flex', style: { gap: '8px' } }, [
        el('button', { class: 'btn ghost', style: { flex: 1 }, onclick: () => close(false) }, cancelLabel),
        el('button', { class: `btn ${danger ? 'danger' : 'primary'} lg`, style: { flex: 1, ...(danger ? { background: 'var(--bad)', color: '#fff' } : {}) }, onclick: () => close(true) }, confirmLabel),
      ]),
    ].filter(Boolean));
    back.appendChild(card);
    document.body.appendChild(back);
    requestAnimationFrame(() => { card.style.transform = 'translateY(0)'; });
    back.addEventListener('click', (e) => { if (e.target === back) close(false); });
    function close(result) {
      card.style.transform = 'translateY(20px)';
      back.style.opacity = '0';
      back.style.transition = 'opacity .2s';
      setTimeout(() => { back.remove(); resolve(result); }, 200);
    }
  });
}

// ---------------- Inline prompt ----------------
// Replaces `window.prompt()` — returns Promise<string | null>.
/**
 * @param {{ title?: string, body?: string, placeholder?: string, defaultValue?: string, type?: string, confirmLabel?: string, cancelLabel?: string }} [opts]
 * @returns {Promise<string|null>}
 */
export function promptInput({ title = '', body = '', placeholder = '', defaultValue = '', type = 'text', confirmLabel = 'Save', cancelLabel = 'Cancel' } = {}) {
  return new Promise((resolve) => {
    const back = el('div', { style: { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.55)', zIndex: '300', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } });
    const input = /** @type {HTMLInputElement} */ (el('input', {
      type, placeholder, value: defaultValue,
      style: { width: '100%', padding: '12px 14px', fontSize: '17px', marginBottom: '12px' },
    }));
    const card = el('div', {
      style: {
        background: 'var(--bg-2)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
        padding: '18px 16px calc(env(safe-area-inset-bottom) + 16px)',
        width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow)',
        transform: 'translateY(20px)', transition: 'transform .25s cubic-bezier(.2,.8,.2,1)',
      },
    }, [
      el('div', { class: 'grabber', style: { width: '40px', height: '4px', background: 'var(--line-2)', borderRadius: '2px', margin: '0 auto 12px' } }),
      el('h3', { style: { margin: '0 0 6px' } }, title),
      body ? el('p', { class: 'muted', style: { margin: '0 0 12px' } }, body) : null,
      input,
      el('div', { class: 'row-flex', style: { gap: '8px' } }, [
        el('button', { class: 'btn ghost', style: { flex: 1 }, onclick: () => close(null) }, cancelLabel),
        el('button', { class: 'btn primary lg', style: { flex: 1 }, onclick: () => close(input.value) }, confirmLabel),
      ]),
    ].filter(Boolean));
    back.appendChild(card);
    document.body.appendChild(back);
    requestAnimationFrame(() => { card.style.transform = 'translateY(0)'; input.focus(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value); else if (e.key === 'Escape') close(null); });
    back.addEventListener('click', (e) => { if (e.target === back) close(null); });
    function close(result) {
      card.style.transform = 'translateY(20px)';
      back.style.opacity = '0';
      back.style.transition = 'opacity .2s';
      setTimeout(() => { back.remove(); resolve(result); }, 200);
    }
  });
}

// ---------------- Skeleton loader ----------------
// Returns a shimmer-block element for "loading" states.
export function skeleton({ width = '100%', height = '16px', rounded = '6px', count = 1 } = {}) {
  const make = () => el('div', {
    style: {
      width, height, borderRadius: rounded,
      background: 'linear-gradient(90deg, var(--bg-3) 0%, var(--line) 50%, var(--bg-3) 100%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s linear infinite',
      marginBottom: '8px',
    },
  });
  if (count === 1) return make();
  return el('div', {}, Array.from({ length: count }, make));
}

// ---------------- Markdown (tiny renderer for coach replies) ----------------
// Supports bold, italic, bullets, line breaks, inline code. Sanitized via textContent.
export function renderMarkdown(text) {
  const root = el('div', {});
  if (!text) return root;
  const lines = String(text).split('\n');
  let listEl = null;
  for (const ln of lines) {
    const bullet = ln.match(/^\s*[-*•]\s+(.+)$/);
    if (bullet) {
      if (!listEl) {
        listEl = el('ul', { style: { margin: '4px 0', paddingLeft: '20px' } });
        root.appendChild(listEl);
      }
      listEl.appendChild(el('li', { style: { margin: '2px 0' } }, [renderInline(bullet[1])]));
      continue;
    }
    listEl = null;
    if (!ln.trim()) { root.appendChild(el('div', { style: { height: '6px' } })); continue; }
    const heading = ln.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const tag = `h${Math.min(4, heading[1].length + 2)}`;
      root.appendChild(el(tag, { style: { margin: '8px 0 4px' } }, [renderInline(heading[2])]));
      continue;
    }
    const p = el('p', { style: { margin: '4px 0' } }, [renderInline(ln)]);
    root.appendChild(p);
  }
  return root;
}
function renderInline(text) {
  const frag = document.createDocumentFragment();
  // Tokenize: **bold**, *italic*, `code`
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`]+`)/g;
  let last = 0; let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const tok = m[0];
    if (tok.startsWith('**') || tok.startsWith('__')) {
      const s = document.createElement('strong'); s.textContent = tok.slice(2, -2); frag.appendChild(s);
    } else if (tok.startsWith('`')) {
      const c = document.createElement('code'); c.textContent = tok.slice(1, -1);
      c.style.cssText = 'background:var(--bg-3);padding:2px 5px;border-radius:4px;font-size:.9em';
      frag.appendChild(c);
    } else if (tok.startsWith('*')) {
      const i = document.createElement('em'); i.textContent = tok.slice(1, -1); frag.appendChild(i);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

// ---------------- Photo lightbox ----------------
// Tap-to-expand a photo into a fullscreen viewer.
export function openLightbox(dataURL, caption) {
  const back = el('div', {
    style: { position: 'fixed', inset: '0', background: '#000', zIndex: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
  });
  const img = el('img', { src: dataURL, style: { maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' } });
  const cap = caption ? el('div', { style: { color: '#fff', fontSize: '13px', marginTop: '12px', opacity: '.8' } }, caption) : null;
  const close = el('button', {
    style: { position: 'absolute', top: 'calc(env(safe-area-inset-top, 16px) + 12px)', right: '16px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '0', borderRadius: '20px', padding: '8px 14px', fontWeight: '600', cursor: 'pointer' },
    onclick: () => back.remove(),
  }, '✕ Close');
  back.appendChild(img);
  if (cap) back.appendChild(cap);
  back.appendChild(close);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  document.body.appendChild(back);
  haptic('select');
}

// ---------------- Empty state ----------------
// A friendly empty-state block with an inline SVG glyph, message, and optional action.
const EMPTY_GLYPHS = {
  run: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="40" cy="12" r="5"/><path d="M36 22l-10 6 6 8-8 14M32 36l10 4 6 10M22 30l-10 2"/></svg>',
  diet: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 8v20a6 6 0 0 0 12 0V8M26 8v48M44 8c-4 0-6 6-6 14s2 10 6 10v24"/></svg>',
  progress: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 52h48M16 52V36M30 52V24M44 52V14"/></svg>',
  coach: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14h44v30H30l-12 10V44H10z"/></svg>',
  workout: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 26v12M16 22v20M48 22v20M56 26v12M16 32h32"/></svg>',
  generic: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="22"/><path d="M32 22v14M32 42h.01"/></svg>',
};
/**
 * @param {{ glyph?: string, title?: string, body?: string, actionLabel?: string, onAction?: (() => void) }} [opts]
 */
export function emptyState({ glyph = 'generic', title, body, actionLabel, onAction } = {}) {
  return el('div', { style: { textAlign: 'center', padding: '28px 16px', color: 'var(--text-faint)' } }, [
    el('div', { style: { color: 'var(--line-2)', marginBottom: '12px' }, html: EMPTY_GLYPHS[glyph] || EMPTY_GLYPHS.generic }),
    title ? el('div', { style: { fontWeight: 700, color: 'var(--text-dim)', marginBottom: '4px' } }, title) : null,
    body ? el('p', { class: 'faint', style: { margin: '0 auto', maxWidth: '260px' } }, body) : null,
    actionLabel ? el('button', { class: 'btn sm primary', style: { marginTop: '12px' }, onclick: onAction }, actionLabel) : null,
  ]);
}

// ---------------- Undoable delete ----------------
// Removes immediately + offers Undo for 5s via toast.
export function deleteWithUndo(label, doDelete, doRestore) {
  doDelete();
  toast(`Deleted ${label}`, '', { label: 'Undo', fn: () => { doRestore(); toast(`Restored ${label}`, 'success'); } });
}

// ---------------- Animated exercise demonstration ----------------
// free-exercise-db ships two frames per exercise (0.jpg = start, 1.jpg = end). Alternating them
// loops the movement like a short video/GIF. Self-cleans its timer once removed from the DOM,
// preloads the second frame for a flicker-free swap, falls back gracefully, and respects
// prefers-reduced-motion (shows a single static frame instead of animating).
/**
 * @param {{ imageUrl?: string, name?: string } | null | undefined} exercise
 * @param {{ maxHeight?: string, speed?: number, compact?: boolean }} [opts]
 * @returns {HTMLElement}
 */
export function exerciseDemo(exercise, { maxHeight = '300px', speed = 650, compact = false } = {}) {
  const base = String(exercise?.imageUrl || '').replace(/\/[01]\.jpg$/i, '');
  const wrap = el('div', { class: 'ex-demo' + (compact ? ' compact' : '') });
  if (!base) { wrap.classList.add('empty'); wrap.appendChild(el('div', { class: 'ex-demo-fallback' }, '🏋')); return wrap; }

  const frames = [base + '/0.jpg', base + '/1.jpg'];
  const img = /** @type {HTMLImageElement} */ (el('img', {
    class: 'ex-demo-img', src: frames[0], alt: (exercise?.name || 'Exercise') + ' demonstration',
    style: { maxHeight }, loading: 'eager', decoding: 'async',
  }));
  img.onerror = () => { wrap.classList.add('empty'); img.remove(); if (!wrap.querySelector('.ex-demo-fallback')) wrap.appendChild(el('div', { class: 'ex-demo-fallback' }, '🏋')); };
  wrap.appendChild(img);

  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  let twoFrames = false, cur = 0;
  const probe = new Image();
  probe.onload = () => { twoFrames = true; };
  probe.src = frames[1];                                  // preload + verify the second frame

  if (!reduce) {
    wrap.appendChild(el('span', { class: 'ex-demo-badge' }, '↻ loop'));
    const timer = setInterval(() => {
      if (!img.isConnected) { clearInterval(timer); return; }  // self-clean when screen re-renders
      if (!twoFrames) return;
      cur = cur ? 0 : 1;
      img.src = frames[cur];
    }, speed);
  }
  return wrap;
}
