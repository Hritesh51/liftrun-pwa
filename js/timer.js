// Rest timer — runs in foreground, schedules a notification at the end-time
// so iOS can deliver an alert if the user backgrounds or locks the phone.
import { haptic, emit, on } from './util.js';

let endsAt = 0;          // ms timestamp
let totalSec = 0;        // initial duration
let raf = null;
let notifTimer = null;
let wakeLock = null;
let fab, ring, label;

export function mountTimer(rootEl) {
  if (fab) return;
  fab = document.createElement('button');
  fab.id = 'timerFab';
  fab.className = 'timer-fab hidden';
  fab.setAttribute('aria-label', 'Rest timer');
  fab.innerHTML = `
    <svg class="ring" width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r="40" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="4"/>
      <circle id="timerRing" cx="44" cy="44" r="40" fill="none" stroke="#0b0d10" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="251.327" stroke-dashoffset="0"/>
    </svg>
    <span id="timerLabel" style="position:relative;z-index:1">0:00</span>
  `;
  let longPress, didLong = false;
  fab.addEventListener('click', () => {
    if (didLong) { didLong = false; return; }
    expand(); // tap → full-screen breathing view
  });
  fab.addEventListener('contextmenu', e => { e.preventDefault(); stop(); });
  fab.addEventListener('pointerdown', () => {
    didLong = false;
    longPress = setTimeout(() => { didLong = true; stop(); }, 600);
  });
  fab.addEventListener('pointerup', () => clearTimeout(longPress));
  fab.addEventListener('pointerleave', () => clearTimeout(longPress));
  rootEl.appendChild(fab);
  ring  = fab.querySelector('#timerRing');
  label = fab.querySelector('#timerLabel');
}

// Full-screen breathing rest view.
let overlay = null, overlayRaf = null;
function expand() {
  if (!isRunning() || overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'rest-overlay';
  overlay.innerHTML = `
    <div class="rest-breathe">
      <svg width="240" height="240" viewBox="0 0 240 240">
        <circle cx="120" cy="120" r="110" fill="none" stroke="var(--line)" stroke-width="6"/>
        <circle id="restRing" cx="120" cy="120" r="110" fill="none" stroke="var(--accent)" stroke-width="6"
                stroke-linecap="round" stroke-dasharray="691.15" stroke-dashoffset="0" transform="rotate(-90 120 120)"/>
      </svg>
      <div class="rest-count" id="restCount">0:00</div>
      <div class="rest-sub">Rest — breathe</div>
    </div>
    <div class="rest-actions">
      <button class="btn lg" id="restAdd">+15s</button>
      <button class="btn primary lg" id="restSkip">Skip rest</button>
    </div>
    <button class="rest-close" id="restClose" aria-label="Minimize">▾</button>
  `;
  document.body.appendChild(overlay);
  /** @type {HTMLElement} */ (overlay.querySelector('#restAdd')).onclick = () => add(15);
  /** @type {HTMLElement} */ (overlay.querySelector('#restSkip')).onclick = () => { stop(); collapse(); };
  /** @type {HTMLElement} */ (overlay.querySelector('#restClose')).onclick = collapse;
  paintOverlay();
}
function collapse() {
  if (overlay) { overlay.remove(); overlay = null; }
  cancelAnimationFrame(overlayRaf);
}
function paintOverlay() {
  if (!overlay) return;
  const remainMs = endsAt - Date.now();
  if (remainMs <= 0) { collapse(); return; }
  const remain = Math.ceil(remainMs / 1000);
  const m = Math.floor(remain / 60), s = remain % 60;
  const cnt = overlay.querySelector('#restCount');
  const ring = overlay.querySelector('#restRing');
  if (cnt) cnt.textContent = `${m}:${String(s).padStart(2, '0')}`;
  if (ring) { const frac = remainMs / (totalSec * 1000); ring.style.strokeDashoffset = (691.15 * (1 - frac)).toFixed(1); }
  overlayRaf = requestAnimationFrame(paintOverlay);
}

export function start(sec) {
  if (!sec || sec <= 0) return;
  totalSec = sec;
  endsAt = Date.now() + sec * 1000;
  fab?.classList.remove('hidden');
  scheduleNotification(sec);
  acquireWakeLock();
  tick();
}
export function add(sec) {
  if (!isRunning()) return;
  endsAt += sec * 1000;
  totalSec = Math.max(totalSec, Math.ceil((endsAt - Date.now()) / 1000));
  scheduleNotification(Math.max(0, (endsAt - Date.now()) / 1000));
  haptic('light');
}
export function stop() {
  endsAt = 0; totalSec = 0;
  fab?.classList.add('hidden');
  cancelAnimationFrame(raf);
  clearTimeout(notifTimer);
  releaseWakeLock();
  collapse();
  emit('timer', { status: 'stopped' });
}
export function isRunning() { return endsAt > Date.now(); }

function tick() {
  cancelAnimationFrame(raf);
  const remainMs = endsAt - Date.now();
  if (remainMs <= 0) {
    label.textContent = '0:00';
    ring.style.strokeDashoffset = 251.327;
    haptic('timer');
    emit('timer', { status: 'done' });
    fireForegroundAlert();
    stop();
    return;
  }
  const remain = Math.ceil(remainMs / 1000);
  const m = Math.floor(remain / 60), s = remain % 60;
  label.textContent = `${m}:${String(s).padStart(2, '0')}`;
  const frac = remainMs / (totalSec * 1000);
  ring.style.strokeDashoffset = (251.327 * (1 - frac)).toFixed(2);
  raf = requestAnimationFrame(tick);
}

function scheduleNotification(secFromNow) {
  clearTimeout(notifTimer);
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  notifTimer = setTimeout(() => {
    try {
      navigator.serviceWorker?.ready?.then(reg => {
        reg.showNotification('Rest complete', /** @type {any} */ ({
          body: 'Time to lift.',
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          vibrate: [40, 60, 40],
          tag: 'rest-timer',
          renotify: true,
        }));
      }).catch(() => {
        new Notification('Rest complete', { body: 'Time to lift.', icon: 'icons/icon-192.png' });
      });
    } catch {}
  }, Math.max(0, secFromNow * 1000));
}
function fireForegroundAlert() {
  // Audible ping via Web Audio (no asset needed).
  try {
    const ctx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.55);
  } catch {}
}

async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {}
}
function releaseWakeLock() { try { wakeLock?.release(); } catch {} wakeLock = null; }

// Re-acquire wake lock on visibility change while a timer runs.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isRunning() && !wakeLock) acquireWakeLock();
  if (document.visibilityState === 'visible' && isRunning()) tick();
});

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}
