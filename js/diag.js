// On-device diagnostics: capture uncaught errors + promise rejections into a small, capped
// ring buffer in localStorage so the user can read/copy them on their phone (no network, no
// third-party service). A lightweight stand-in for Sentry while there's no backend.
const KEY = 'liftrun.diag';
const MAX = 25;

/** @returns {Array<{ t: string, kind: string, msg: string, src?: string }>} */
export function getLog() {
  try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
export function clearLog() { try { localStorage.removeItem(KEY); } catch {} }

/** @param {string} kind @param {string} msg @param {string} [src] */
function record(kind, msg, src) {
  try {
    const log = getLog();
    log.unshift({ t: new Date().toISOString(), kind, msg: String(msg).slice(0, 500), src });
    localStorage.setItem(KEY, JSON.stringify(log.slice(0, MAX)));
  } catch {}
}

let installed = false;
export function installErrorCapture() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (e) => {
    const src = e.filename ? `${e.filename.split('/').pop()}:${e.lineno}:${e.colno}` : undefined;
    record('error', (e.message || 'Error') + (e.error?.stack ? '\n' + e.error.stack.split('\n').slice(0, 3).join('\n') : ''), src);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = /** @type {any} */ (e).reason;
    record('promise', (r && (r.stack || r.message)) || String(r));
  });
}

/** Plain-text dump for copy/paste bug reports. */
export function asText() {
  const log = getLog();
  if (!log.length) return 'No errors recorded. 🎉';
  return log.map(e => `[${e.t}] ${e.kind}${e.src ? ' @ ' + e.src : ''}\n${e.msg}`).join('\n\n');
}
