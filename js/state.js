// LocalStorage-backed state. One JSON document. Reactive via emit('state').
import { uid, isoNow, emit, dayKey } from './util.js';
import { PROGRAMS, EXERCISES, EXERCISE_INDEX } from './seed.js';
import { HOME_INDEX } from './home-data.js';

// Active storage key. Defaults to the legacy single-user key; the profiles layer
// (profiles.js) repoints this to a per-profile namespace ("liftrun.v1::<id>") before load().
export const LEGACY_KEY = 'liftrun.v1';
let KEY = LEGACY_KEY;
/** Point state persistence at a specific profile's namespace. Call before load(). */
export function setStorageKey(k) { KEY = k || LEGACY_KEY; }
export function getStorageKey() { return KEY; }

const DEFAULTS = {
  version: 1,
  user: {
    heightCm: 168, // 5'6"
    startingWeightKg: 63,
    goal: 'hypertrophy',
    experience: 'beginner',
  },
  settings: {
    units: 'kg',                  // 'kg' | 'lb'
    autoAlternateWeeks: true,     // flip A/B every 7 days
    deloadEvery: 6,               // weeks (5–7 typical)
    apiKey: '',
    aiProvider: 'anthropic',      // 'anthropic' | 'openai'
    aiModel: 'claude-opus-4-7',   // overridable in Settings
    notifications: true,
    showBroSplitNote: true,
    theme: 'dark',                // 'dark' | 'light' | 'system'
    textSize: 'default',          // 'default' | 'large' | 'larger'
    coachPersona: 'balanced',     // 'balanced' | 'strict' | 'supportive' | 'hardcore'
  },
  schedule: {
    startDate: null,              // first lifting day, ISO date
    currentWeekType: 'A',         // 'A' or 'B'
    nextDayIndex: 0,              // index into PROGRAMS[A|B].days for the next session
    weekStartedAt: null,          // ISO date for the first day of the current 7-day window
    overrideForToday: null,       // optional { dayId } to override what today's session is
  },
  programs: {
    // Live, editable copies of A/B days. Filled in init().
    A: null,
    B: null,
  },
  sessions: [],                   // WorkoutSession[]
  sets:     [],                   // LoggedSet[]
  runs:     [],                   // RunActivity[]
  body:     [],                   // BodyMetric[]
  coachMessages: [],              // CoachMessage[]
  customExercises: [],            // user-added exercises
  prs: {},                        // { exerciseId: { bestE1RM, bestWeightKg, bestReps, bestVolume, lastUpdated } }
  readiness: [],                  // pre-session check-ins { date, sleep, soreness, energy, pain }

  // Diet
  dietPreferences: {
    dietary: 'vegetarian',        // 'vegetarian' | 'eggetarian' | 'non-veg' | 'vegan'
    allergies: '',                // free text
    proteinPerKg: 1.8,            // g/kg/day target
    surplusKcal: 250,             // mild surplus over maintenance
    supplementsAvailable: ['milk', 'curd', 'paneer'], // user-set common adds
  },
  weeklyMenus: [],                // [{ id, uploadedAt, source ('image'|'text'), weekStart, days: [...] }]
  dailyDietPlans: [],             // [{ id, date, dayName, meals, supplements, totals, advice }]
  mealLogs: [],                   // [{ id, date, items: [{item, portion, proteinG, kcal}], totals, sourceImage? }]
  shoppingList: null,             // { generatedAt, items: [{ name, qty, unit }] }

  // Body — extended
  painLog: [],                    // [{ id, date, bodyPart, side?, severity 1-5, withMovement?, note }]
  tape: [],                       // [{ id, date, chestCm, leftArmCm, rightArmCm, waistCm, leftThighCm, rightThighCm, leftCalfCm, rightCalfCm, neckCm }]
  photos: [],                     // [{ id, date, dataURL, pose ('front'|'side'|'back') }]

  // Programming
  mesoConfig: {
    enabled: false,
    startedAt: null,
    lengthWeeks: 5,               // typical 4-6
    currentWeek: 1,               // 1..lengthWeeks
    baseVolumeMultiplier: 0.85,   // week 1 = 85% of MAV
    peakVolumeMultiplier: 1.10,   // last full week = 110% of MAV
  },
  exerciseRotation: {},           // { exerciseId: { firstUsed, lastReplaced } }
  customVolumeLandmarks: {},      // override defaults: { chest: { mev, mav, mrv } }

  // Goals + race
  goals: {
    targetWeightKg: null,
    targetDate: null,             // ISO date
    targetLifts: {},              // { exerciseId: { weightKg, reps } }
    notes: '',
  },
  raceGoal: null,                 // { distanceMeters, targetSeconds, raceDate }
  hrZones: {
    maxHR: null,                  // user-entered or derived
    restingHR: null,
  },

  // Home training
  trainingMode: 'gym',            // 'gym' | 'home'
  equipment: {                    // what the user owns at home
    bands: false, dumbbells: false, 'pullup-bar': false, 'dip-station': false,
    bench: false, kettlebell: false, vest: false,
  },
  homeProgramId: 'HOME_FB',       // 'HOME_FB' | 'HOME_UL' | 'HOME_PPL'
  homeLadderPos: {},              // { pattern: exerciseId } — current ladder position per movement
  homeSchedule: { nextDayIndex: 0 },

  // Operational
  travelMode: false,              // this week is no-gym
  nudges: {
    caffeineMinBeforeWorkout: 30, // 0 = off
    hydrationDuringWorkout: true,
    sleepEarlyBeforeLegs: true,
    fuelBeforeLegs: true,
    lowAdherenceCheckin: true,    // ping if no log for 3 days
    audioCoachingMidSet: false,   // voice cues during sets
  },

  // Elite-tier features
  dailyLogs: [],                  // [{ id, date, sleepHours, sleepQuality 1-5, mood 1-5, energy 1-5, hunger 1-5, hrvMs?, restingHR?, stress 1-5, note? }]
  waterLog: [],                   // [{ id, date, ml }] — multiple entries per day
  hungerLog: [],                  // [{ id, date, level 1-5, context? }]
  jointEvents: [],                // computed events: [{ joint, date, loadDelta, source }]
  movementScreen: null,           // { date, overheadSquat 1-5, shoulderReach 1-5, singleLegBalance 1-5, ankleDorsi 1-5, hipMobility 1-5, asymmetryNotes, weakLinks: [] }
  mobilityDoneLog: [],            // [{ id, date, durationMin }]
  bloodwork: [],                  // [{ id, date, totalCholesterol?, ldl?, hdl?, glucose?, vitD?, ferritin?, testosterone?, note? }]
  voiceNotes: [],                 // [{ id, date, sessionId?, transcript, summary? }]
  periodizationStyle: 'linear',   // 'linear' | 'dup' | 'block'
  pinnedCards: ['stress','readiness','meso','run','diet','coach'], // Today card order
  cheatBudget: { weeklyTotalKcal: null, days: {} }, // Mon..Sun planned kcal
  weeklyStrategy: null,           // { generatedAt, weekStart, text }
  symmetryFlags: [],              // [{ exerciseId, side: 'L'|'R', deltaPct, lastChecked }]
  installedAt: isoNow(),
};

function fresh() {
  // Deep-clone DEFAULTS so nested arrays/objects aren't shared across resets.
  // (Critical: without this, state.sets.push(...) mutates DEFAULTS.sets and the next reset would return the dirty array.)
  const cloned = JSON.parse(JSON.stringify(DEFAULTS));
  const A = JSON.parse(JSON.stringify(PROGRAMS.A));
  const B = JSON.parse(JSON.stringify(PROGRAMS.B));
  return { ...cloned, programs: { A, B }, installedAt: isoNow() };
}

let state;

// Deep-merge for migration: ensure newly-added nested keys appear without overwriting user data.
function deepMerge(defaults, override) {
  if (override === null || override === undefined) return defaults;
  if (typeof defaults !== 'object' || Array.isArray(defaults)) return override;
  const out = { ...defaults };
  for (const k of Object.keys(override)) {
    const dv = defaults[k];
    const ov = override[k];
    if (dv && typeof dv === 'object' && !Array.isArray(dv) && ov && typeof ov === 'object' && !Array.isArray(ov)) {
      out[k] = deepMerge(dv, ov);
    } else {
      out[k] = ov;
    }
  }
  return out;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw);
      // Self-heal: ensure programs exist (in case of partial state)
      if (!state.programs?.A || !state.programs?.B) {
        const seeded = fresh();
        state.programs = seeded.programs;
      }
      // Deep-merge so newly added nested defaults (mesoConfig, dietPreferences, nudges, hrZones, etc.)
      // appear without clobbering existing user data.
      state = deepMerge(fresh(), state);
    } else {
      state = fresh();
      save();
    }
  } catch (e) {
    console.error('Failed to load state, starting fresh', e);
    state = fresh();
    save();
  }
  return state;
}

let saveTimer;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Save failed', e);
    }
  }, 50);
}

export function get() { return state; }

export function update(fn) {
  fn(state);
  save();
  emit('state', state);
}

// ---------------- Exercises ----------------
export function allExercises() {
  return [...EXERCISES, ...(state.customExercises || [])];
}
export function getExercise(id) {
  return EXERCISE_INDEX[id] || HOME_INDEX[id] || (state.customExercises || []).find(e => e.id === id);
}

// ---------------- Sessions ----------------
export function startSession(dayId, dayName) {
  const session = {
    id: uid(),
    date: isoNow(),
    dayId,
    dayLabel: dayName,
    weekType: state.trainingMode === 'home' ? 'HOME' : state.schedule.currentWeekType,
    status: 'active',
    notes: '',
    startedAt: isoNow(),
  };
  update(s => { s.sessions.unshift(session); });
  return session;
}
export function activeSession() {
  return state.sessions.find(s => s.status === 'active');
}
export function endSession(sessionId, opts = {}) {
  update(s => {
    const idx = s.sessions.findIndex(x => x.id === sessionId);
    if (idx === -1) return;
    s.sessions[idx].status = opts.skipped ? 'skipped' : 'done';
    s.sessions[idx].endedAt = isoNow();
    if (opts.notes != null) s.sessions[idx].notes = opts.notes;
  });
}

// ---------------- Sets ----------------
export function logSet(set) {
  const entry = {
    id: uid(),
    createdAt: isoNow(),
    type: 'working',
    rpe: null,
    perSide: false,
    restTakenSec: null,
    ...set,
  };
  update(s => { s.sets.push(entry); });
  return entry;
}
export function updateSet(id, patch) {
  update(s => {
    const idx = s.sets.findIndex(x => x.id === id);
    if (idx >= 0) s.sets[idx] = { ...s.sets[idx], ...patch };
  });
}
export function deleteSet(id) {
  update(s => { s.sets = s.sets.filter(x => x.id !== id); });
}
export function setsForSession(sessionId) {
  return state.sets.filter(s => s.sessionId === sessionId);
}
export function setsForExercise(exerciseId, limit = 200) {
  return state.sets.filter(s => s.exerciseId === exerciseId).slice(-limit);
}
export function lastSessionWith(exerciseId, beforeSessionId = null) {
  // Find the most recent prior session that included this exercise.
  const sessions = state.sessions.filter(s => s.status === 'done' || s.id === beforeSessionId);
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (beforeSessionId && sessions[i].id === beforeSessionId) continue;
    const ss = state.sets.filter(x => x.sessionId === sessions[i].id && x.exerciseId === exerciseId && x.type === 'working');
    if (ss.length) return { session: sessions[i], sets: ss };
  }
  return null;
}

// ---------------- Runs ----------------
export function logRun(run) {
  const r = { id: uid(), createdAt: isoNow(), source: 'inApp', ...run };
  update(s => { s.runs.unshift(r); });
  return r;
}
export function deleteRun(id) { update(s => { s.runs = s.runs.filter(r => r.id !== id); }); }

// ---------------- Body ----------------
export function logBody(entry) {
  const e = { id: uid(), date: isoNow(), ...entry };
  update(s => { s.body.unshift(e); });
  return e;
}
export function deleteBody(id) { update(s => { s.body = s.body.filter(b => b.id !== id); }); }

// ---------------- Coach messages ----------------
export function pushCoachMessage(msg) {
  const m = { id: uid(), createdAt: isoNow(), ...msg };
  update(s => { s.coachMessages.push(m); });
  return m;
}

// ---------------- Readiness check-ins ----------------
export function logReadiness(r) {
  const entry = { id: uid(), date: isoNow(), ...r };
  update(s => { s.readiness.unshift(entry); });
  return entry;
}
export function todaysReadiness() {
  const k = dayKey();
  return state.readiness.find(r => dayKey(r.date) === k);
}

// ---------------- Pain / Tape / Photos ----------------
export function logPain(entry) {
  // Validate severity is in 1..5.
  const sev = Number(entry?.severity);
  if (!Number.isFinite(sev) || sev < 1 || sev > 5) {
    throw new Error('Pain severity must be 1–5');
  }
  const e = { id: uid(), date: isoNow(), status: 'active', ...entry, severity: Math.round(sev) };
  update(s => { s.painLog.unshift(e); });
  return e;
}
export function resolvePain(id, resolution = 'resolved') {
  update(s => {
    const i = s.painLog.findIndex(p => p.id === id);
    if (i >= 0) s.painLog[i].status = resolution;
  });
}
export function deletePain(id) { update(s => { s.painLog = s.painLog.filter(p => p.id !== id); }); }

export function logTape(entry) {
  const e = { id: uid(), date: isoNow(), ...entry };
  update(s => { s.tape.unshift(e); });
  return e;
}
export function deleteTape(id) { update(s => { s.tape = s.tape.filter(t => t.id !== id); }); }

// Photos: the (large) dataURL goes to IndexedDB; only lightweight metadata lives in localStorage.
export function logPhoto(entry) {
  const id = entry.id || uid();
  const e = { id, date: entry.date || isoNow(), pose: entry.pose || 'front' };
  const dataURL = entry.dataURL;
  // Store image bytes in IDB (falls back to inline storage if IDB is unavailable).
  if (dataURL) {
    import('./idb.js').then(({ idbPut, idbAvailable }) => {
      if (idbAvailable()) idbPut('photo:' + id, dataURL).catch(() => { /* fall back below */ inlinePhoto(id, dataURL); });
      else inlinePhoto(id, dataURL);
    }).catch(() => inlinePhoto(id, dataURL));
  }
  update(s => { s.photos.unshift(e); });
  return e;
}
function inlinePhoto(id, dataURL) {
  update(s => { const p = s.photos.find(x => x.id === id); if (p) p.dataURL = dataURL; });
}
// Async fetch of a photo's image data (IDB first, then any inline fallback).
export async function getPhotoData(photo) {
  if (photo.dataURL) return photo.dataURL; // legacy / fallback inline
  try {
    const { idbGet } = await import('./idb.js');
    return await idbGet('photo:' + photo.id);
  } catch { return null; }
}
export function deletePhoto(id) {
  update(s => { s.photos = s.photos.filter(p => p.id !== id); });
  import('./idb.js').then(({ idbDel }) => idbDel('photo:' + id).catch(() => {})).catch(() => {});
}

// One-time migration: move any inline photo dataURLs (from before IDB) into IndexedDB.
export async function migratePhotosToIDB() {
  const inline = state.photos.filter(p => p.dataURL);
  if (!inline.length) return;
  try {
    const { idbPut, idbAvailable } = await import('./idb.js');
    if (!idbAvailable()) return;
    for (const p of inline) {
      await idbPut('photo:' + p.id, p.dataURL);
    }
    update(s => { for (const p of s.photos) delete p.dataURL; });
  } catch { /* keep inline as fallback */ }
}

// ---------------- Meso / rotation / goals / race ----------------
export function setMesoConfig(patch) { update(s => { s.mesoConfig = { ...s.mesoConfig, ...patch }; }); }
export function startMeso(weeks = 5) {
  update(s => {
    s.mesoConfig = { ...s.mesoConfig, enabled: true, startedAt: isoNow(), lengthWeeks: weeks, currentWeek: 1 };
  });
}
export function endMeso() {
  update(s => { s.mesoConfig.enabled = false; });
}
export function markExerciseUsed(exerciseId) {
  update(s => {
    const cur = s.exerciseRotation[exerciseId] || { firstUsed: isoNow() };
    cur.lastUsed = isoNow();
    s.exerciseRotation[exerciseId] = cur;
  });
}
export function markExerciseRotated(exerciseId) {
  update(s => {
    const cur = s.exerciseRotation[exerciseId] || {};
    cur.lastRotated = isoNow();
    s.exerciseRotation[exerciseId] = cur;
  });
}
export function setGoals(patch) { update(s => { s.goals = { ...s.goals, ...patch }; }); }
export function setRaceGoal(race) { update(s => { s.raceGoal = race; }); }
export function setHRZones(zones) { update(s => { s.hrZones = { ...s.hrZones, ...zones }; }); }
export function setTravelMode(on) { update(s => { s.travelMode = !!on; }); }
export function setNudges(patch) { update(s => { s.nudges = { ...s.nudges, ...patch }; }); }
export function setCustomLandmarks(muscle, patch) {
  update(s => {
    s.customVolumeLandmarks[muscle] = { ...s.customVolumeLandmarks[muscle], ...patch };
  });
}

// ---------------- Home training ----------------
export function setTrainingMode(mode) { update(s => { s.trainingMode = mode; }); }
export function setEquipment(id, val) { update(s => { s.equipment = { ...s.equipment, [id]: !!val }; }); }
export function setHomeProgram(id) { update(s => { s.homeProgramId = id; s.homeSchedule = { nextDayIndex: 0 }; }); }
export function advanceHomeDay(dayCount) {
  update(s => {
    const cur = s.homeSchedule?.nextDayIndex || 0;
    s.homeSchedule = { nextDayIndex: (cur + 1) % dayCount };
  });
}

// ---------------- Elite features ----------------
export function logDaily(entry) {
  // One per date — overwrite if already logged today
  const k = dayKey(entry.date || new Date());
  const e = { id: uid(), date: isoNow(), ...entry };
  update(s => {
    s.dailyLogs = s.dailyLogs.filter(x => dayKey(x.date) !== k);
    s.dailyLogs.unshift(e);
  });
  return e;
}
export function todaysDailyLog() {
  const k = dayKey();
  return state.dailyLogs.find(d => dayKey(d.date) === k) || null;
}

export function logWater(ml) {
  const e = { id: uid(), date: isoNow(), ml };
  update(s => { s.waterLog.unshift(e); });
  return e;
}
export function todaysWaterMl() {
  const k = dayKey();
  return state.waterLog.filter(w => dayKey(w.date) === k).reduce((a, w) => a + (w.ml || 0), 0);
}
export function deleteWater(id) { update(s => { s.waterLog = s.waterLog.filter(w => w.id !== id); }); }

export function logHunger(level, context) {
  const e = { id: uid(), date: isoNow(), level, context };
  update(s => { s.hungerLog.unshift(e); });
  return e;
}

export function saveMovementScreen(screen) {
  const e = { id: uid(), date: isoNow(), ...screen };
  update(s => { s.movementScreen = e; });
  return e;
}
export function markMobilityDone(durationMin = 5) {
  const e = { id: uid(), date: isoNow(), durationMin };
  update(s => { s.mobilityDoneLog.unshift(e); });
  return e;
}

export function logBloodwork(entry) {
  const e = { id: uid(), date: isoNow(), ...entry };
  update(s => { s.bloodwork.unshift(e); });
  return e;
}
export function deleteBloodwork(id) { update(s => { s.bloodwork = s.bloodwork.filter(b => b.id !== id); }); }

export function logVoiceNote(transcript, opts = {}) {
  const e = { id: uid(), date: isoNow(), transcript, ...opts };
  update(s => { s.voiceNotes.unshift(e); });
  return e;
}
export function deleteVoiceNote(id) { update(s => { s.voiceNotes = s.voiceNotes.filter(v => v.id !== id); }); }

export function setPeriodizationStyle(style) { update(s => { s.periodizationStyle = style; }); }
export function setPinnedCards(arr) { update(s => { s.pinnedCards = arr; }); }
export function setCheatBudget(patch) { update(s => { s.cheatBudget = { ...s.cheatBudget, ...patch }; }); }
export function setWeeklyStrategy(strat) { update(s => { s.weeklyStrategy = strat; }); }

// ---------------- Meal logs / shopping list ----------------
export function logMeal(entry) {
  const e = { id: uid(), date: isoNow(), ...entry };
  update(s => { s.mealLogs.unshift(e); });
  return e;
}
export function deleteMeal(id) { update(s => { s.mealLogs = s.mealLogs.filter(m => m.id !== id); }); }
export function setShoppingList(list) { update(s => { s.shoppingList = list; }); }

// ---------------- Diet ----------------
export function setDietPreferences(patch) {
  update(s => { s.dietPreferences = { ...s.dietPreferences, ...patch }; });
}
export function addWeeklyMenu(menu) {
  // Guard: always ensure a days[] exists so screens don't crash.
  const m = { id: uid(), uploadedAt: isoNow(), days: [], ...menu };
  if (!Array.isArray(m.days)) m.days = [];
  update(s => { s.weeklyMenus.unshift(m); });
  return m;
}
export function deleteWeeklyMenu(id) {
  update(s => { s.weeklyMenus = s.weeklyMenus.filter(m => m.id !== id); });
}
export function activeWeeklyMenu() {
  // The most recently uploaded menu (one per week typically)
  return state.weeklyMenus[0] || null;
}
export function saveDailyDietPlan(plan) {
  const p = { id: uid(), createdAt: isoNow(), ...plan };
  update(s => {
    // Keep at most one plan per date
    s.dailyDietPlans = s.dailyDietPlans.filter(x => dayKey(x.date) !== dayKey(p.date));
    s.dailyDietPlans.unshift(p);
  });
  return p;
}
export function dailyDietPlanFor(date = new Date()) {
  const k = dayKey(date);
  return state.dailyDietPlans.find(p => dayKey(p.date) === k) || null;
}

// ---------------- Settings / schedule mutators ----------------
export function setSetting(key, value) {
  update(s => { s.settings[key] = value; });
}
export function setSchedule(patch) {
  update(s => { s.schedule = { ...s.schedule, ...patch }; });
}

// ---------------- PR tracking ----------------
export function updatePRs(exerciseId, { e1, weightKg, reps, volume }) {
  update(s => {
    const cur = s.prs[exerciseId] || { bestE1RM: 0, bestWeightKg: 0, bestReps: 0, bestVolume: 0, bodyweight: weightKg === 0 };
    let changed = false;
    if (e1 > cur.bestE1RM) { cur.bestE1RM = e1; changed = true; }
    if (weightKg > cur.bestWeightKg || (weightKg === cur.bestWeightKg && reps > cur.bestReps)) {
      cur.bestWeightKg = weightKg; cur.bestReps = reps; changed = true;
    }
    if (volume > cur.bestVolume) { cur.bestVolume = volume; changed = true; }
    if (changed) {
      cur.bodyweight = (cur.bestWeightKg || 0) === 0; // pure-bodyweight PRs are rep PRs
      cur.lastUpdated = isoNow();
      s.prs[exerciseId] = cur;
    }
    return changed;
  });
}

// ---------------- Export / import ----------------
export function exportAll() {
  return JSON.stringify(state, null, 2);
}
export function importAll(json) {
  const parsed = JSON.parse(json);
  if (parsed && typeof parsed === 'object') {
    state = { ...fresh(), ...parsed };
    save(); emit('state', state);
    return true;
  }
  return false;
}
export function reset() {
  state = fresh();
  save(); emit('state', state);
}
