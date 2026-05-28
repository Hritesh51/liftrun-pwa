// Local, device-only multi-profile "accounts". No backend, no network — each profile is an
// isolated copy of the app state stored under its own localStorage key ("liftrun.v1::<id>").
// A profile may carry an optional PIN (SHA-256 hashed). This is light gating for shared phones,
// NOT real security — anything in localStorage is readable by someone with the device + devtools.
import { uid, isoNow } from './util.js';
import * as S from './state.js';

const REG_KEY = 'liftrun.profiles';

/** @typedef {{ id: string, name: string, accent: string, pinHash: string|null, createdAt: string }} Profile */
/** @typedef {{ profiles: Profile[], activeId: string|null }} Registry */

/** @returns {Registry} */
export function loadRegistry() {
  try {
    const r = JSON.parse(localStorage.getItem(REG_KEY) || 'null');
    if (r && Array.isArray(r.profiles)) return r;
  } catch {}
  return { profiles: [], activeId: null };
}
/** @param {Registry} reg */
function saveRegistry(reg) { localStorage.setItem(REG_KEY, JSON.stringify(reg)); }

export function listProfiles() { return loadRegistry().profiles; }
export function activeId() { return loadRegistry().activeId; }
/** @param {string|null|undefined} id */
export function getProfile(id) { return loadRegistry().profiles.find(p => p.id === id) || null; }
/** Per-profile state key. @param {string} id */
export function stateKeyFor(id) { return S.LEGACY_KEY + '::' + id; }

// ---- PIN (optional, hashed) ----
/** @param {string} pin */
export async function hashPin(pin) {
  if (!pin) return null;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('liftrun:' + pin));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return 'plain:' + pin; }
}
/** @param {string} id @param {string} pin */
export async function verifyPin(id, pin) {
  const p = getProfile(id);
  if (!p || !p.pinHash) return true;
  return (await hashPin(pin)) === p.pinHash;
}

// ---- Per-session unlock (PIN required once per app launch) ----
const UNLOCK_KEY = 'liftrun.unlocked';
/** @param {string} id */
export function markUnlocked(id) { try { sessionStorage.setItem(UNLOCK_KEY, id); } catch {} }
/** @param {string} id */
export function isUnlocked(id) {
  const p = getProfile(id);
  if (!p || !p.pinHash) return true;            // no PIN ⇒ always unlocked
  try { return sessionStorage.getItem(UNLOCK_KEY) === id; } catch { return false; }
}
export function clearUnlock() { try { sessionStorage.removeItem(UNLOCK_KEY); } catch {} }

// ---- One-time migration of pre-profiles single-user data ----
// Adopts existing "liftrun.v1" data as the first profile so nothing is lost on upgrade.
export function migrateLegacyIfNeeded() {
  const reg = loadRegistry();
  if (reg.profiles.length) return reg;
  const legacy = localStorage.getItem(S.LEGACY_KEY);
  const id = uid();
  if (legacy) {
    try { localStorage.setItem(stateKeyFor(id), legacy); } catch {}
    reg.profiles.push({ id, name: 'Me', accent: 'orange', pinHash: null, createdAt: isoNow() });
    reg.activeId = id;
    saveRegistry(reg);
  }
  return reg;
}

// ---- CRUD / activation ----
/**
 * Create a new profile and initialise its state with the chosen theme + accent.
 * @param {{ name?: string, accent?: string, theme?: string, pin?: string }} opts
 * @returns {Promise<string>} the new profile id
 */
export async function createProfile({ name, accent = 'orange', theme = 'dark', pin = '' } = {}) {
  const reg = loadRegistry();
  const id = uid();
  const pinHash = pin ? await hashPin(pin) : null;
  reg.profiles.push({ id, name: (name || 'Lifter').trim().slice(0, 24) || 'Lifter', accent, pinHash, createdAt: isoNow() });
  reg.activeId = id;
  saveRegistry(reg);
  // Initialise this profile's state at its own key with the chosen theme.
  S.setStorageKey(stateKeyFor(id));
  S.load();                       // fresh state created + persisted at the new key
  S.setSetting('theme', theme);
  if (pinHash) markUnlocked(id);  // creator is already authenticated
  return id;
}

/** Switch the active profile, loading its isolated state. @param {string} id */
export function activate(id) {
  const reg = loadRegistry();
  if (!reg.profiles.some(p => p.id === id)) return false;
  reg.activeId = id;
  saveRegistry(reg);
  S.setStorageKey(stateKeyFor(id));
  S.load();
  return true;
}

/** @param {string} id @param {string} name */
export function renameProfile(id, name) {
  const reg = loadRegistry();
  const p = reg.profiles.find(x => x.id === id);
  if (p) { p.name = (name || '').trim().slice(0, 24) || p.name; saveRegistry(reg); }
}

/**
 * Add or update a registry entry WITHOUT activating it. Used by cloud sync to restore a
 * profile that exists remotely but not yet on this device.
 * @param {{ id: string, name?: string, accent?: string }} p
 */
export function upsertProfileMeta({ id, name, accent }) {
  const reg = loadRegistry();
  let p = reg.profiles.find(x => x.id === id);
  if (!p) {
    p = { id, name: (name || 'Synced').slice(0, 24), accent: accent || '#ff6438', pinHash: null, createdAt: isoNow() };
    reg.profiles.push(p);
  } else if (name) { p.name = String(name).slice(0, 24); }
  if (!reg.activeId) reg.activeId = id;
  saveRegistry(reg);
}
/** @param {string} id @param {string} pin */
export async function setPin(id, pin) {
  const reg = loadRegistry();
  const p = reg.profiles.find(x => x.id === id);
  if (p) { p.pinHash = pin ? await hashPin(pin) : null; saveRegistry(reg); if (!pin) markUnlocked(id); }
}
/** @param {string} id */
export function deleteProfile(id) {
  const reg = loadRegistry();
  reg.profiles = reg.profiles.filter(p => p.id !== id);
  try { localStorage.removeItem(stateKeyFor(id)); } catch {}
  if (reg.activeId === id) reg.activeId = reg.profiles[0] ? reg.profiles[0].id : null;
  saveRegistry(reg);
}

/**
 * Decide what the app should show on boot.
 * @returns {{ gate: 'create'|'pin'|'ok', id: string }}
 */
export function gateState() {
  const reg = loadRegistry();
  if (!reg.profiles.length) return { gate: 'create', id: '' };
  const id = reg.activeId && reg.profiles.some(p => p.id === reg.activeId)
    ? reg.activeId : reg.profiles[0].id;
  const p = getProfile(id);
  if (p && p.pinHash && !isUnlocked(id)) return { gate: 'pin', id };
  return { gate: 'ok', id };
}
