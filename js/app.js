// Main entry: load state, wire router, mount global timer + sheets.

// Defensive: patch replaceChildren / append / prepend so they filter null/undefined/false.
// Native methods coerce these to the literal strings "null" / "undefined" / "false" — a footgun.
(function patchDomMethods() {
  const filterArgs = (args) => {
    const out = [];
    const flatten = (x) => {
      if (x == null || x === false || x === true) return;
      if (Array.isArray(x)) { for (const i of x) flatten(i); return; }
      out.push(x);
    };
    for (const a of args) flatten(a);
    return out;
  };
  const proto = /** @type {any} */ (Element.prototype);
  if (proto.replaceChildren && !proto.__safePatched) {
    const orig = proto.replaceChildren;
    proto.replaceChildren = function (...args) { return orig.apply(this, filterArgs(args)); };
    const origAppend = proto.append;
    proto.append = function (...args) { return origAppend.apply(this, filterArgs(args)); };
    const origPrepend = proto.prepend;
    proto.prepend = function (...args) { return origPrepend.apply(this, filterArgs(args)); };
    proto.__safePatched = true;
  }
})();

import { $, $$ , el, on, emit, toast } from './util.js';
import * as S from './state.js';
import * as Timer from './timer.js';
import * as Onboarding from './screens/onboarding.js';
import * as Today from './screens/today.js';
import * as Workout from './screens/workout.js';
import * as ExerciseScreen from './screens/exercise.js';
import * as ProgramScreen from './screens/program.js';
import * as RunScreen from './screens/run.js';
import * as Progress from './screens/progress.js';
import * as Coach from './screens/coach.js';
import * as BodyScreen from './screens/body.js';
import * as Settings from './screens/settings.js';
import * as Sheets from './screens/sheets.js';
import * as DietScreen from './screens/diet.js';
import * as Profiles from './profiles.js';
import { mountGate, renderProfilesSheet } from './screens/account.js';
import { renderAboutSheet } from './screens/about.js';
import { installErrorCapture } from './diag.js';
import { requestPersistence } from './backup.js';
import * as Sync from './sync.js';
import { scheduleDailyNudges } from './nudges.js';

// Start capturing uncaught errors immediately (on-device diagnostics, viewable in Settings).
installErrorCapture();

// Lazy-loaded sheet modules — only fetched when a sheet is first opened (code-splitting).
const lazySheets = {
  pain:           () => import('./screens/pain.js').then(m => m.renderPainSheet),
  plateCalc:      () => import('./screens/platecalc.js').then(m => m.renderPlateCalcSheet),
  quickLog:       () => import('./screens/quicklog.js').then(m => m.renderQuickLogSheet),
  formReview:     () => import('./screens/formreview.js').then(m => m.renderFormReviewSheet),
  skipDay:        () => import('./screens/skipday.js').then(m => m.renderSkipSheet),
  dailyLog:       () => import('./screens/elite.js').then(m => m.renderDailyLogSheet),
  movementScreen: () => import('./screens/elite.js').then(m => m.renderMovementScreenSheet),
  mobility:       () => import('./screens/elite.js').then(m => m.renderMobilitySheet),
  voiceDebrief:   () => import('./screens/elite.js').then(m => m.renderVoiceDebriefSheet),
  bloodwork:      () => import('./screens/elite.js').then(m => m.renderBloodworkSheet),
  tour:           () => import('./screens/tour.js').then(m => m.renderTourSheet),
  equipment:      () => import('./screens/equipment.js').then(m => m.renderEquipmentSheet),
  density:        () => import('./screens/density.js').then(m => m.renderDensitySheet),
};

// State is loaded once a profile is resolved (see boot at the bottom). Until then, S.get()
// is undefined — so nothing may render before startApp() runs.

// Apply theme + text size on boot + on changes.
function applyAppearance() {
  const st = S.get()?.settings || {};
  document.documentElement.setAttribute('data-theme', st.theme || 'dark');
  document.documentElement.setAttribute('data-textsize', st.textSize || 'default');
}
on('state', applyAppearance);

const view = $('#view');

// ---------------- Sheet system ----------------
const sheetBack = el('div', { class: 'sheet-back', onclick: () => router.closeSheet() });
const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
const sheetClose = el('button', { class: 'sheet-close', 'aria-label': 'Close', onclick: () => router.closeSheet() }, '✕');
const sheetBody = el('div', {});
sheet.appendChild(sheetClose);
sheet.appendChild(sheetBody);
document.body.appendChild(sheetBack);
document.body.appendChild(sheet);

// ---------------- Multi-detent sheet gestures ----------------
// Sheets snap between a half detent (tall content only) and full, and can be flung or
// dragged down to dismiss. A drag begins from the sticky grabber, or by pulling DOWN while
// the content is already scrolled to the top — so taps and inner scrolling still work normally.
const SheetCtl = (() => {
  let sheetH = 0;          // rendered sheet height (px), capped by max-height:92dvh
  let detents = [];        // visible heights, ascending — e.g. [halfVisible, sheetH]
  let active = false;      // a pointer/touch is currently down
  let dragging = false;    // committed to dragging the sheet (vs. scrolling content)
  let decided = false;     // for content-area starts: direction has been resolved
  let fromGrabber = false;
  let startY = 0, lastY = 0, lastT = 0, vel = 0, baseT = 0, moved = 0;

  const vhpx = () => window.innerHeight;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const curT = () => { const m = /translateY\(([-0-9.]+)px\)/.exec(sheet.style.transform || ''); return m ? parseFloat(m[1]) : 0; };

  function setT(t, withBack = true) {
    sheet.style.transform = `translateY(${t}px)`;
    if (withBack) sheetBack.style.opacity = String(clamp(1 - t / Math.max(1, sheetH), 0, 1));
  }

  // Measure content + compute detents. Run after a sheet's content is in the DOM.
  function layout() {
    sheet.style.transition = 'none';
    sheet.style.transform = '';
    sheet.classList.remove('dragging');
    sheetH = sheet.offsetHeight;                         // content height, capped by max-height
    const half = Math.round(0.5 * vhpx());
    const enableHalf = sheetH > 0.72 * vhpx() && half < sheetH - 60;
    detents = enableHalf ? [half, sheetH] : [sheetH];
    setT(0);                                             // open at full
    requestAnimationFrame(() => { sheet.style.transition = ''; });
  }

  // Pure snap decision: given the current visible height + finger velocity, pick a target
  // visible height from [0 (dismiss), ...detents]. A clear flick moves one detent in its
  // direction; otherwise snap to the nearest detent by position. Velocity is clamped so a
  // freak tiny-dt reading can never project to an unintended dismiss.
  function choose(visible, velocity) {
    const cands = [0, ...detents];                       // ascending; 0 = dismissed
    let idx = 0, bd = Infinity;
    cands.forEach((c, i) => { const d = Math.abs(c - visible); if (d < bd) { bd = d; idx = i; } });
    const FLING = 0.55;                                  // px/ms = an intentional flick
    const v = Math.max(-4, Math.min(4, velocity || 0));
    if (v > FLING && idx > 0) idx--;                     // flick down → one detent lower
    else if (v < -FLING && idx < cands.length - 1) idx++; // flick up → one detent higher
    return cands[idx];
  }

  function start(ev) {
    const t = ev.target;
    if (t.closest && t.closest('.sheet-close')) return;  // let the × button handle its own tap
    fromGrabber = !!(t.closest && t.closest('.grabber'));
    active = true; dragging = false; decided = false; moved = 0;
    startY = lastY = (ev.touches ? ev.touches[0].clientY : ev.clientY);
    lastT = performance.now(); vel = 0; baseT = curT();
    if (fromGrabber) { dragging = true; decided = true; sheet.classList.add('dragging'); }
  }

  function move(ev) {
    if (!active) return;
    const y = (ev.touches ? ev.touches[0].clientY : ev.clientY);
    const now = performance.now(); const dt = now - lastT;
    if (dt > 0) vel = (y - lastY) / dt;                  // px/ms, +ve = downward
    lastY = y; lastT = now;
    const dy = y - startY; moved = Math.max(moved, Math.abs(dy));
    if (!decided) {
      // Content-area: only hijack into a sheet-drag when pulling DOWN at the very top.
      if (dy > 5 && sheet.scrollTop <= 0) { dragging = true; decided = true; sheet.classList.add('dragging'); }
      else if (Math.abs(dy) > 5) { decided = true; dragging = false; return; }   // it's a content scroll
      else return;
    }
    if (!dragging) return;
    let t = baseT + dy;
    if (t < 0) t *= 0.28;                                 // rubber-band above full
    t = Math.min(t, sheetH);                              // never past fully-closed
    setT(t);
    if (ev.cancelable) ev.preventDefault();               // suppress native scroll while dragging
  }

  function end() {
    if (!active) return;
    active = false;
    if (!dragging) { decided = false; return; }
    dragging = false; decided = false;
    sheet.classList.remove('dragging');
    // Grabber tap (no real movement) = dismiss, matching the old behaviour.
    if (fromGrabber && moved < 6) { router.closeSheet(); return; }
    const visible = sheetH - curT();
    const targetVisible = choose(visible, vel);
    if (targetVisible <= 0) { router.closeSheet(); return; }
    setT(sheetH - targetVisible);
  }

  // touchmove must be non-passive so we can preventDefault when hijacking a content pull-down.
  sheet.addEventListener('touchstart', start, { passive: true });
  sheet.addEventListener('touchmove', move, { passive: false });
  sheet.addEventListener('touchend', end, { passive: true });
  sheet.addEventListener('touchcancel', end, { passive: true });
  // Mouse only via pointer events (touch already handled above; avoids double-firing).
  sheet.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') start(e); });
  sheet.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') move(e); });
  sheet.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') end(); });
  window.addEventListener('resize', () => { if (sheet.classList.contains('open')) layout(); });

  return {
    layout,
    animateClose() {
      sheet.classList.remove('dragging');
      sheet.style.transition = '';
      sheetBack.style.opacity = '';                       // hand fade-out back to CSS
      const h = sheetH || sheet.offsetHeight || 1000;
      requestAnimationFrame(() => { sheet.style.transform = `translateY(${h}px)`; });
    },
    // Clear inline styles once closed so the next open starts from a clean slate.
    reset() {
      if (sheet.classList.contains('open')) return;       // reopened in the meantime — leave it
      sheet.style.transition = ''; sheet.style.transform = ''; sheet.style.height = '';
      sheetBack.style.opacity = '';
      sheetH = 0; detents = []; active = dragging = decided = false;
      sheet.classList.remove('dragging');
    },
    // Test hooks (read-only) for deterministic verification.
    _test: { choose: (vis, vel) => choose(vis, vel), detents: () => detents.slice(), sheetH: () => sheetH },
  };
})();

// Helper used by router.openSheet/closeSheet to lock body scroll when a sheet is showing.
function lockBodyScroll(lock) {
  document.body.style.overflow = lock ? 'hidden' : '';
  document.documentElement.style.overflow = lock ? 'hidden' : '';
  if (lock) sheet.style.touchAction = 'auto';
}

// Mount the global rest-timer FAB.
Timer.mountTimer(document.body);

// ---------------- Router ----------------
const router = {
  /** @type {{ route: string, params: any } | null} */
  current: null,
  /** @type {(() => void) | null} */
  onLeave: null,
  /** @type {(() => void) | null} */
  onSheetClose: null,
  /** @type {Element | null} */
  _lastFocus: null,
  go(route, params) {
    if (this.onLeave) { try { this.onLeave(); } catch {} this.onLeave = null; }
    if (location.hash !== '#' + route) {
      history.pushState({ route, params }, '', '#' + route);
    }
    this.current = { route, params };
    this.render();
  },
  refresh() { this.render(); },
  render() {
    const r = this.current?.route || '';
    const params = this.current?.params || {};
    document.documentElement.scrollTop = 0;
    window.scrollTo(0, 0);
    // tab highlight
    const top = r.split('/')[0];
    $$('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.route === top ? 'page' : 'false'));
    const s = S.get();
    if (!s.user.onboarded && r !== 'onboarding') return Onboarding.render(view, this);
    try {
      if (r === '' || r === 'today') return Today.render(view, this);
      if (r === 'onboarding') return Onboarding.render(view, this);
      if (r.startsWith('workout/')) return Workout.render(view, this, { sessionId: r.split('/')[1] });
      if (r.startsWith('exercise/')) return ExerciseScreen.render(view, this, { id: r.split('/')[1] });
      if (r === 'program') return ProgramScreen.render(view, this);
      if (r.startsWith('programDay/')) {
        const parts = r.split('/');
        return ProgramScreen.renderDay(view, this, { weekType: parts[1], dayIndex: parts[2] });
      }
      if (r === 'run') return RunScreen.render(view, this);
      if (r === 'diet') return DietScreen.render(view, this);
      if (r === 'progress') return Progress.render(view, this);
      if (r === 'coach') return Coach.render(view, this);
      if (r === 'body') return BodyScreen.render(view, this);
      if (r === 'settings') return Settings.render(view, this);
      return Today.render(view, this);
    } catch (e) {
      console.error(e);
      const err = /** @type {any} */ (e);
      view.replaceChildren(el('div', { class: 'card', style: { borderColor: 'var(--bad)' } }, [
        el('h3', { style: { color: 'var(--bad)', margin: '0 0 4px' } }, '⚠ Something broke on this screen'),
        el('p', { class: 'muted', style: { margin: '0 0 8px' } }, err.message || 'Unknown error'),
        el('details', { style: { fontSize: '11px' } }, [
          el('summary', { class: 'faint', style: { cursor: 'pointer' } }, 'Show details'),
          el('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '11px', color: 'var(--text-dim)', overflowX: 'auto', marginTop: '8px' } }, String(err.stack || err.message)),
        ]),
        el('div', { class: 'row-flex', style: { marginTop: '12px', gap: '8px' } }, [
          el('button', { class: 'btn primary', onclick: () => router.go('today') }, 'Back to Today'),
          el('button', { class: 'btn', onclick: () => location.reload() }, 'Reload app'),
        ]),
      ]));
    }
  },
  openSheet(name, ctx = {}) {
    this._lastFocus = document.activeElement;
    sheetBody.replaceChildren(); // clear previous content immediately
    const finishOpen = () => {
      // Start clean so the open animation runs from CSS translateY(100%).
      sheet.style.transform = ''; sheet.style.height = ''; sheet.style.transition = '';
      sheet.scrollTop = 0;
      sheet.classList.add('open'); sheetBack.classList.add('open');
      lockBodyScroll(true);
      requestAnimationFrame(() => {
        SheetCtl.layout();     // measure content → compute detents → settle at full
        const focusable = /** @type {HTMLElement|null} */ (sheet.querySelector('input, select, textarea, button:not(.sheet-close)'));
        try { (focusable || sheetClose).focus({ preventScroll: true }); } catch {}
      });
    };
    // Eagerly-loaded sheets (small / frequently used).
    if (name === 'readiness') { Sheets.renderReadiness(sheetBody, this); return finishOpen(); }
    if (name === 'manualRun') { RunScreen.renderManualSheet(sheetBody, ctx, this); return finishOpen(); }
    if (name === 'swap') { ExerciseScreen.renderSwapSheet(sheetBody, ctx, this); return finishOpen(); }
    if (name === 'addExercise') { Sheets.renderAddExercise(sheetBody, ctx, this); return finishOpen(); }
    if (name === 'uploadMenu') { DietScreen.renderUploadSheet(sheetBody, ctx, this); return finishOpen(); }
    if (name === 'mealPhoto') { DietScreen.renderMealPhotoSheet(sheetBody, ctx, this); return finishOpen(); }
    if (name === 'addTape') { BodyScreen.renderTapeSheet(sheetBody, ctx, this); return finishOpen(); }
    if (name === 'addPhoto') { BodyScreen.renderPhotoSheet(sheetBody, ctx, this); return finishOpen(); }
    if (name === 'raceSetup') { RunScreen.renderRaceSetupSheet(sheetBody, ctx, this); return finishOpen(); }
    if (name === 'profiles') { renderProfilesSheet(sheetBody, ctx, this); return finishOpen(); }
    if (name === 'about') { renderAboutSheet(sheetBody, ctx, this); return finishOpen(); }
    // Lazy-loaded sheets.
    if (lazySheets[name]) {
      finishOpen(); // open immediately (empty), fill when module resolves
      lazySheets[name]().then(renderFn => {
        renderFn(sheetBody, ctx, this);
        // Content height changed — recompute detents now that the module is in.
        requestAnimationFrame(() => SheetCtl.layout());
      })
        .catch(err => { console.error('sheet load failed', name, err); sheetBody.appendChild(el('div', { class: 'card' }, 'Could not load this screen.')); });
    }
  },
  closeSheet() {
    if (this.onSheetClose) { try { this.onSheetClose(); } catch {} this.onSheetClose = null; }
    SheetCtl.animateClose();                 // slide down from wherever it is
    sheet.classList.remove('open'); sheetBack.classList.remove('open');
    lockBodyScroll(false);
    // Restore focus to whatever opened the sheet.
    try { /** @type {any} */ (this._lastFocus)?.focus?.({ preventScroll: true }); } catch {}
    // After the slide-out, wipe inline styles so the next open is pristine.
    setTimeout(() => SheetCtl.reset(), 380);
  },
};

// ---------------- Wire tabs ----------------
$$('.tab').forEach(t => t.addEventListener('click', () => {
  const route = t.dataset.route;
  const currentTop = (router.current?.route || '').split('/')[0];
  if (route === currentTop) {
    // Re-tapping the active tab scrolls to top (iOS-native behavior).
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  router.go(route);
}));

window.addEventListener('popstate', (e) => {
  const route = location.hash.replace(/^#/, '') || 'today';
  if (router.onLeave) { try { router.onLeave(); } catch {} router.onLeave = null; }
  router.current = { route, params: e.state?.params || {} };
  router.render();
});

// React to state changes: flag the active profile as having unsynced edits, and (if cloud
// auto-sync is on) push them after a quiet period.
let _syncDebounce;
on('state', () => {
  Sync.markDirty(Profiles.activeId());
  if (Sync.autoSyncEnabled() && Sync.isSignedIn()) {
    clearTimeout(_syncDebounce);
    _syncDebounce = setTimeout(() => Sync.autoSync().catch(() => {}), 8000);
  }
});

// ---------------- Boot ----------------
// Runs once a profile's state is loaded. Renders the app, schedules nudges, runs the tour.
function startApp() {
  applyAppearance();
  const initial = location.hash.replace(/^#/, '') || 'today';
  router.current = { route: initial, params: {} };
  router.render();
  scheduleDailyNudges().catch(() => {});
  S.migratePhotosToIDB?.().catch(() => {});
  requestPersistence().catch(() => {});   // ask the browser not to evict our data
  Sync.autoSync().catch(() => {});         // pull/push if cloud sync is signed in + enabled
  const u = S.get().user;
  if (u?.onboarded && !u?.tourSeen) setTimeout(() => router.openSheet('tour'), 600);
}

// Resolve the local profile (migrate legacy → create → unlock → activate), then start the app.
{
  Profiles.migrateLegacyIfNeeded();
  const g = Profiles.gateState();
  if (g.gate === 'ok') { Profiles.activate(g.id); startApp(); }
  else { mountGate({ mode: g.gate, id: g.id, onDone: () => startApp() }); }
}

// ---------------- Service worker + update notifier ----------------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    // Watch for an updated SW waiting to take over.
    const showUpdateBanner = (sw) => {
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;bottom:calc(var(--tab-h) + 16px);left:16px;right:16px;background:var(--accent-grad);color:var(--on-accent);padding:14px 16px;border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,.35);z-index:200;display:flex;justify-content:space-between;align-items:center;gap:10px;font-weight:700;';
      banner.innerHTML = `<span>New version ready</span><button style="background:var(--on-accent);color:var(--accent);border:0;padding:8px 14px;border-radius:9px;font-weight:700;cursor:pointer">Reload</button>`;
      const reloadBtn = /** @type {HTMLButtonElement} */ (banner.querySelector('button'));
      reloadBtn.onclick = () => {
        sw.postMessage('SKIP_WAITING');
        sw.addEventListener?.('statechange', () => { if (sw.state === 'activated') location.reload(); });
        setTimeout(() => location.reload(), 800); // fallback
      };
      document.body.appendChild(banner);
    };
    if (reg.waiting) showUpdateBanner(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(nw);
        }
      });
    });
  }).catch(err => console.warn('SW reg failed', err));
}

// ---------------- Install prompt (Android/Chrome) ----------------
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

// ---------------- iOS Add-to-Home-Screen nudge ----------------
window.addEventListener('load', () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(/** @type {any} */ (window).MSStream);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || /** @type {any} */ (window.navigator).standalone;
  if (isIOS && !standalone && !sessionStorage.getItem('a2hsShown')) {
    sessionStorage.setItem('a2hsShown', '1');
    setTimeout(() => toast('Tap Share → Add to Home Screen to install.'), 1200);
  }
});

// ---------------- Expose for debugging ----------------
/** @type {any} */ (window).LiftRun = { S, Timer, router, emit, SheetCtl };
