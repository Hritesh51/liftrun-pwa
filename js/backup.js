// Full-device backup & restore. Captures EVERY local profile (registry + each profile's state)
// plus IndexedDB photos into a single JSON file the user can download and re-import — the safety
// net against browser/iOS storage eviction (which can silently wipe a PWA's data).
import { idbKeys, idbGet, idbPut, idbAvailable } from './idb.js';

const LAST_BACKUP_KEY = 'liftrun.lastBackup';
const BACKUP_INTERVAL_MS = 7 * 86400000;   // nudge to back up weekly

/** Collect every localStorage entry this app owns. */
function collectLocal() {
  /** @type {Record<string,string>} */
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('liftrun.')) { const v = localStorage.getItem(k); if (v != null) out[k] = v; }
  }
  return out;
}

/** Build the full backup object (async because photos live in IndexedDB). */
export async function buildBackup() {
  /** @type {Array<{ key: string, data: string }>} */
  const photos = [];
  if (idbAvailable()) {
    try {
      const keys = await idbKeys();
      for (const k of keys) {
        const data = await idbGet(k);
        if (typeof data === 'string') photos.push({ key: String(k), data });
      }
    } catch {}
  }
  return {
    app: 'liftrun',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    localStorage: collectLocal(),
    photos,
  };
}

/** Trigger a download of the full backup as a dated .json file. */
export async function downloadBackup() {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `liftrun-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  markBackedUp();
  return backup.photos.length;
}

/**
 * Restore from a backup object: rewrite localStorage + IDB photos. Caller should confirm first
 * and reload afterwards. Returns the number of profiles restored.
 * @param {any} backup
 */
export async function restoreBackup(backup) {
  if (!backup || backup.app !== 'liftrun' || typeof backup.localStorage !== 'object') {
    throw new Error('Not a valid LiftRun backup file.');
  }
  // Clear our own localStorage keys first so stale ones don't linger.
  const existing = Object.keys(collectLocal());
  for (const k of existing) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(backup.localStorage)) {
    if (typeof k === 'string' && k.startsWith('liftrun.')) localStorage.setItem(k, String(v));
  }
  if (idbAvailable() && Array.isArray(backup.photos)) {
    for (const p of backup.photos) {
      try { if (p && p.key) await idbPut(p.key, p.data); } catch {}
    }
  }
  const reg = (() => { try { return JSON.parse(backup.localStorage['liftrun.profiles'] || 'null'); } catch { return null; } })();
  return reg && Array.isArray(reg.profiles) ? reg.profiles.length : 0;
}

/** Parse + restore from a File (validates JSON shape). @param {File} file */
export async function restoreFromFile(file) {
  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file isn\'t valid JSON.'); }
  return restoreBackup(parsed);
}

// ---- Backup freshness ----
export function markBackedUp() { try { localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString()); } catch {} }
export function lastBackupAt() { return localStorage.getItem(LAST_BACKUP_KEY); }
export function needsBackup() {
  const last = lastBackupAt();
  if (!last) return true;
  return (Date.now() - new Date(last).getTime()) > BACKUP_INTERVAL_MS;
}

// ---- Storage durability ----
/** Ask the browser to make storage persistent (resists eviction). Best-effort. */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {}
  return false;
}
export async function isPersisted() {
  try { return !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); }
  catch { return false; }
}
/** @returns {Promise<{ usedMB: number, quotaMB: number }|null>} */
export async function storageEstimate() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      return { usedMB: Math.round((e.usage || 0) / 1e5) / 10, quotaMB: Math.round((e.quota || 0) / 1e6) };
    }
  } catch {}
  return null;
}
