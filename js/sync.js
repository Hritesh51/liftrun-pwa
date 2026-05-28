// Optional cloud sync via Supabase — raw REST + GoTrue auth (no SDK, no build step, CSP-safe).
// Each local profile's full state document is stored as one row; sync is rev-based last-write-wins
// with a SAFE bias: conflicts keep the on-device copy, and a snapshot is taken before any overwrite,
// so a sync bug can never silently destroy local data. Sign-in is optional; the app is fully usable
// offline without it.
import { isoNow, emit } from './util.js';
import * as S from './state.js';
import * as Profiles from './profiles.js';
import { buildBackup } from './backup.js';

const CONFIG_KEY = 'liftrun.sync.config';   // { url, anonKey }
const SESSION_KEY = 'liftrun.sync.session'; // { access_token, refresh_token, expires_at, email, user_id }
const META_KEY = 'liftrun.sync.meta';       // { [profileId]: { rev, dirty } }
const LAST_KEY = 'liftrun.sync.last';       // ISO of last successful sync
const AUTO_KEY = 'liftrun.sync.auto';       // '1' when auto-sync enabled
const TABLE = 'liftrun_state';

// ---- tiny localStorage JSON helpers ----
const readJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ---- config ----
export function getConfig() { return readJSON(CONFIG_KEY, null); }
export function setConfig(url, anonKey) {
  const clean = String(url || '').trim().replace(/\/+$/, '');
  writeJSON(CONFIG_KEY, { url: clean, anonKey: String(anonKey || '').trim() });
}
export function isConfigured() { const c = getConfig(); return !!(c && c.url && c.anonKey); }
export function clearConfig() { try { localStorage.removeItem(CONFIG_KEY); } catch {} }

// ---- session ----
export function getSession() { return readJSON(SESSION_KEY, null); }
function setSession(s) { writeJSON(SESSION_KEY, s); }
export function signOut() { try { localStorage.removeItem(SESSION_KEY); } catch {} }
export function isSignedIn() { const s = getSession(); return !!(s && s.access_token); }
export function currentEmail() { return getSession()?.email || null; }
export function autoSyncEnabled() { return localStorage.getItem(AUTO_KEY) === '1'; }
export function setAutoSync(on) { try { on ? localStorage.setItem(AUTO_KEY, '1') : localStorage.removeItem(AUTO_KEY); } catch {} }
export function lastSyncedAt() { return localStorage.getItem(LAST_KEY); }

// ---- sync meta (per-profile revision + dirty flag) ----
function getMeta() { return readJSON(META_KEY, {}); }
function setMeta(m) { writeJSON(META_KEY, m); }
/** Mark a profile as having unsynced local changes. @param {string|null|undefined} pid */
export function markDirty(pid) { if (!pid) return; const m = getMeta(); m[pid] = { rev: m[pid]?.rev || 0, dirty: true }; setMeta(m); }
function setRev(pid, rev) { const m = getMeta(); m[pid] = { rev, dirty: false }; setMeta(m); }
function knownRev(pid) { return getMeta()[pid]?.rev || 0; }
function isDirty(pid) { return !!getMeta()[pid]?.dirty; }

// ---- low-level HTTP ----
function authHeaders() {
  const c = getConfig(); const s = getSession();
  /** @type {Record<string,string>} */
  const h = { apikey: c.anonKey, 'Content-Type': 'application/json' };
  if (s?.access_token) h.Authorization = 'Bearer ' + s.access_token;
  return h;
}

async function refreshIfNeeded() {
  const s = getSession();
  if (!s) throw new Error('Not signed in');
  if (s.expires_at && Date.now() < s.expires_at - 60000) return; // still valid
  const c = getConfig();
  const res = await fetch(`${c.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { apikey: c.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  if (!res.ok) { signOut(); throw new Error('Session expired — sign in again.'); }
  const j = await res.json();
  applyTokenResponse(j);
}

function applyTokenResponse(j) {
  if (!j || !j.access_token) return false;
  setSession({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Date.now() + (j.expires_in ? j.expires_in * 1000 : 3600000),
    email: j.user?.email || getSession()?.email || '',
    user_id: j.user?.id || getSession()?.user_id || '',
  });
  return true;
}

// ---- auth ----
/** @param {string} email @param {string} password */
export async function signIn(email, password) {
  const c = getConfig(); if (!c) throw new Error('Add your Supabase URL + key first.');
  const res = await fetch(`${c.url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: c.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(j.error_description || j.msg || j.message || 'Sign-in failed.');
  applyTokenResponse(j);
  return true;
}

/** @param {string} email @param {string} password */
export async function signUp(email, password) {
  const c = getConfig(); if (!c) throw new Error('Add your Supabase URL + key first.');
  const res = await fetch(`${c.url}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: c.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_description || j.msg || j.message || 'Sign-up failed.');
  // If email confirmation is disabled, signup returns a session immediately.
  if (applyTokenResponse(j)) return { signedIn: true };
  return { signedIn: false }; // needs email confirmation → user must confirm then sign in
}

// ---- REST (PostgREST) ----
async function restGet() {
  const c = getConfig();
  const res = await fetch(`${c.url}/rest/v1/${TABLE}?select=profile_id,name,state,rev,updated_at`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Pull failed (' + res.status + '). Check the table + RLS policy.');
  return res.json();
}
async function restUpsert(row) {
  const c = getConfig();
  const res = await fetch(`${c.url}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: { ...authHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error('Push failed (' + res.status + ').');
}

// ---- conflict decision (pure + unit-tested) ----
/**
 * @param {number} remoteRev @param {number} localRev @param {boolean} localDirty
 * @returns {'apply'|'push'|'skip'|'conflict'}
 */
export function decideApply(remoteRev, localRev, localDirty) {
  if (remoteRev > localRev) return localDirty ? 'conflict' : 'apply';   // newer remote
  return localDirty ? 'push' : 'skip';                                  // local same/newer
}

// ---- core sync ----
function pushProfile(pid, supersedeRev = 0) {
  const stateStr = localStorage.getItem(Profiles.stateKeyFor(pid));
  if (stateStr == null) return Promise.resolve();
  const prof = Profiles.getProfile(pid);
  const rev = Math.max(knownRev(pid), supersedeRev) + 1;
  let stateObj; try { stateObj = JSON.parse(stateStr); } catch { return Promise.resolve(); }
  const s = getSession();
  return restUpsert({
    user_id: s.user_id, profile_id: pid, name: prof?.name || 'Synced',
    state: stateObj, rev, updated_at: isoNow(),
  }).then(() => setRev(pid, rev));
}

/**
 * Pull remote, reconcile, push local-newer. Safe: snapshots before applying any overwrite,
 * and conflicts keep the on-device copy. @returns {Promise<{pulled:number,pushed:number,conflicts:number,restored:number}>}
 */
export async function syncNow() {
  if (!isSignedIn()) throw new Error('Sign in to sync.');
  await refreshIfNeeded();
  const remote = await restGet();
  const remoteById = new Map(remote.map(r => [r.profile_id, r]));

  let pulled = 0, pushed = 0, conflicts = 0, restored = 0;
  let snapshotted = false;
  const snapshotOnce = async () => { if (!snapshotted) { snapshotted = true; try { writeJSON('liftrun.sync.preSync', await buildBackup()); } catch {} } };

  const activeId = Profiles.activeId();
  let activeChanged = false;

  // 1) Apply remote rows that are newer (or restore profiles missing locally).
  for (const r of remote) {
    const exists = !!Profiles.getProfile(r.profile_id);
    if (!exists) {
      await snapshotOnce();
      localStorage.setItem(Profiles.stateKeyFor(r.profile_id), JSON.stringify(r.state));
      Profiles.upsertProfileMeta({ id: r.profile_id, name: r.name });
      setRev(r.profile_id, r.rev);
      restored++; continue;
    }
    const decision = decideApply(r.rev, knownRev(r.profile_id), isDirty(r.profile_id));
    if (decision === 'apply') {
      await snapshotOnce();
      localStorage.setItem(Profiles.stateKeyFor(r.profile_id), JSON.stringify(r.state));
      Profiles.upsertProfileMeta({ id: r.profile_id, name: r.name });
      setRev(r.profile_id, r.rev);
      pulled++;
      if (r.profile_id === activeId) activeChanged = true;
    } else if (decision === 'conflict') {
      conflicts++;                              // keep local; it gets pushed below, superseding remote
    }
  }

  // 2) Push local profiles that are dirty, in conflict, or missing remotely.
  for (const p of Profiles.listProfiles()) {
    const r = remoteById.get(p.id);
    const decision = r ? decideApply(r.rev, knownRev(p.id), isDirty(p.id)) : 'push';
    if (decision === 'push' || decision === 'conflict' || !r) {
      await pushProfile(p.id, r ? r.rev : 0);
      pushed++;
    }
  }

  // 3) If the active profile's state was replaced by a remote copy, reload it live.
  if (activeChanged && activeId) { S.setStorageKey(Profiles.stateKeyFor(activeId)); S.load(); emit('state', S.get()); }

  localStorage.setItem(LAST_KEY, isoNow());
  return { pulled, pushed, conflicts, restored };
}

/** Best-effort background sync (used on boot when auto-sync is on). */
export function autoSync() {
  if (!isConfigured() || !isSignedIn() || !autoSyncEnabled()) return Promise.resolve(null);
  return syncNow().catch(() => null);
}
