// Scheduling + progression + readiness + plateau detection.
// Pure-ish functions; mutators go through state.js.
import * as S from './state.js';
import { e1RM, dayKey, daysBetween, isoNow, roundTo, clamp } from './util.js';
import { PROGRAMS, SUBSTITUTIONS, EXERCISE_INDEX } from './seed.js';
import { homeProgram, resolveHomeDay } from './home.js';

// ---------------- Schedule ----------------

export function getProgram(weekType) {
  // Always read the user-editable copy from state (falls back to seed).
  const s = S.get();
  return (s.programs && s.programs[weekType]) || PROGRAMS[weekType];
}

export function todayDay() {
  const s = S.get();
  // HOME MODE — use the home program, resolving pattern slots to concrete exercises.
  if (s.trainingMode === 'home') {
    const prog = homeProgram();
    const idx = s.homeSchedule?.nextDayIndex || 0;
    const rawDay = prog.days[idx] || prog.days[0];
    return { weekType: 'HOME', day: resolveHomeDay(rawDay), dayIndex: idx, home: true, programDayCount: prog.days.length };
  }
  const sched = s.schedule;
  if (sched.overrideForToday) {
    const [wt, idx] = sched.overrideForToday.split(':');
    const prog = getProgram(wt);
    if (prog && prog.days[Number(idx)]) {
      return { weekType: wt, day: prog.days[Number(idx)], dayIndex: Number(idx) };
    }
  }
  const prog = getProgram(sched.currentWeekType);
  const day = prog.days[sched.nextDayIndex] || prog.days[0];
  return { weekType: sched.currentWeekType, day, dayIndex: sched.nextDayIndex };
}

export function dayAt(weekType, dayIndex) {
  const prog = getProgram(weekType);
  return prog.days[dayIndex];
}

// Advance to the next day in the schedule. Roll over weeks + flip A/B if autoAlternate.
export function advanceDay() {
  const s = S.get();
  if (s.trainingMode === 'home') {
    const prog = homeProgram();
    S.advanceHomeDay(prog.days.length);
    return;
  }
  const prog = getProgram(s.schedule.currentWeekType);
  let next = s.schedule.nextDayIndex + 1;
  let weekType = s.schedule.currentWeekType;
  if (next >= prog.days.length) {
    next = 0;
    if (s.settings.autoAlternateWeeks) weekType = weekType === 'A' ? 'B' : 'A';
  }
  S.setSchedule({
    currentWeekType: weekType,
    nextDayIndex: next,
    overrideForToday: null,
    weekStartedAt: next === 0 ? dayKey() : s.schedule.weekStartedAt,
  });
}

// Manual: pick a specific day from a specific week to do today.
export function overrideToday(weekType, dayIndex) {
  S.setSchedule({ overrideForToday: `${weekType}:${dayIndex}` });
}
export function clearOverride() {
  S.setSchedule({ overrideForToday: null });
}

// Set the very first start date (called from onboarding).
export function setStartDate(date) {
  S.setSchedule({
    startDate: typeof date === 'string' ? date : date.toISOString(),
    weekStartedAt: dayKey(date),
    nextDayIndex: 0,
    currentWeekType: 'A',
  });
}

// How many weeks since start (for deload trigger).
export function weeksSinceStart() {
  const s = S.get();
  if (!s.schedule.startDate) return 0;
  return Math.max(0, Math.floor(daysBetween(s.schedule.startDate, new Date()) / 7));
}

// True if this week should be a deload (every N weeks, configurable).
export function isDeloadWeek() {
  const s = S.get();
  const n = clamp(s.settings.deloadEvery || 6, 4, 8);
  const w = weeksSinceStart();
  if (w === 0) return false;
  return ((w + 1) % (n + 1)) === 0; // every n training weeks, one deload week
}

// ---------------- Progression engine ----------------

// Returns { weightKg, reps, sets, note, rpeCap } suggested for the next session.
// Pure double-progression: hit top of range across all working sets => +smallest load, reset to repLow.
// If no history => start light, RPE 6–7.
export function suggestNextSet(exerciseId, slot, opts = {}) {
  const last = S.lastSessionWith(exerciseId);
  const ex = EXERCISE_INDEX[exerciseId];
  const isMachine = ex?.equipment === 'machine' || ex?.equipment === 'cable';
  const step = (slot.loadStep) || (isMachine ? 2.5 : 2.5);
  // Deload = either the simple calendar-based heuristic OR an active mesocycle's deload week.
  let mesoDeload = false;
  try {
    const s = S.get();
    if (s?.mesoConfig?.enabled) {
      const days = Math.floor(daysBetween(s.mesoConfig.startedAt, new Date()));
      const weeksIn = Math.floor(days / 7);
      const currentWeek = Math.min(s.mesoConfig.lengthWeeks, weeksIn + 1);
      mesoDeload = currentWeek >= s.mesoConfig.lengthWeeks;
    }
  } catch {}
  const deload = isDeloadWeek() || mesoDeload;

  if (!last) {
    // No history. RPE-7 ramp, conservative. Don't suggest a number — let the user dial in.
    return {
      weightKg: null,
      reps: slot.repLow,
      sets: slot.sets,
      rpeCap: 7,
      note: 'First time — start light, leave 3–4 reps in reserve. Add weight next session if it felt easy.',
      basis: 'first-time',
    };
  }

  const sets = last.sets.filter(s => s.type === 'working');
  if (!sets.length) {
    return { weightKg: null, reps: slot.repLow, sets: slot.sets, rpeCap: 7, note: 'Restart with a comfortable weight.', basis: 'no-working-sets' };
  }
  const lastWeight = Math.max(...sets.map(s => s.weightKg || 0));
  const minReps = Math.min(...sets.map(s => s.reps || 0));
  const maxReps = Math.max(...sets.map(s => s.reps || 0));
  const allHitTop = sets.length >= slot.sets && minReps >= slot.repHigh;
  const struggling = maxReps < slot.repLow;

  if (deload) {
    return {
      weightKg: roundTo(lastWeight * 0.85, step),
      reps: slot.repLow,
      sets: Math.max(2, slot.sets - 1),
      rpeCap: 6,
      note: 'Deload week — about 85% of last load, easy effort. Recovery is the point.',
      basis: 'deload',
    };
  }
  if (allHitTop) {
    return {
      weightKg: roundTo(lastWeight + step, step),
      reps: slot.repLow,
      sets: slot.sets,
      rpeCap: 8,
      note: `You hit ${slot.repHigh}+ across all sets — bump load. Reps reset to ${slot.repLow}; build back up.`,
      basis: 'progress',
    };
  }
  if (struggling) {
    return {
      weightKg: roundTo(lastWeight * 0.92, step),
      reps: slot.repLow,
      sets: slot.sets,
      rpeCap: 7,
      note: `Last session was below the ${slot.repLow}-rep floor — drop ~8% and rebuild reps.`,
      basis: 'micro-deload',
    };
  }
  // Otherwise: hold load, push reps.
  return {
    weightKg: lastWeight,
    reps: Math.min(slot.repHigh, minReps + 1),
    sets: slot.sets,
    rpeCap: 8,
    note: `Same weight as last time. Aim for one more rep per set until you hit ${slot.repHigh} clean.`,
    basis: 'add-reps',
  };
}

// ---------------- Plateau detection ----------------

// Returns array of plateauing exerciseIds with reason.
export function detectPlateaus(weeks = 3) {
  const s = S.get();
  const cutoff = Date.now() - weeks * 7 * 86400000;
  const plateaus = [];
  for (const ex of Object.keys(s.prs || {})) {
    const last = s.prs[ex].lastUpdated;
    if (!last) continue;
    if (new Date(last).getTime() < cutoff) {
      plateaus.push({ exerciseId: ex, lastPR: last });
    }
  }
  return plateaus;
}

// ---------------- Readiness autoregulation ----------------

// Score 0..100 from a check-in. Returns a session adjustment factor.
// Inputs: sleep (1–5), soreness (1–5), energy (1–5), pain (boolean), site?
export function readinessScore({ sleep = 3, soreness = 3, energy = 3, pain = false }) {
  // Higher sleep/energy = better. Higher soreness = worse.
  let score = 0;
  score += (sleep - 1) * 12.5;     // 0..50
  score += (energy - 1) * 12.5;    // 0..50
  score -= (soreness - 1) * 12.5;  // 0..-50
  score = clamp(score + 50, 0, 100); // re-center
  if (pain) score = Math.min(score, 35);
  return Math.round(score);
}
export function readinessAdvice(score, pain = false) {
  if (pain) return { factor: 0, mode: 'pain', text: 'Pain reported — skip the lift today. Mobility, an easy walk/run, or rest. If pain is sharp or persistent, see a professional.' };
  if (score < 35) return { factor: 0.6, mode: 'easy', text: 'Low readiness — cut load ~15–20%, drop one set per exercise, and stop with 3 reps in reserve.' };
  if (score < 60) return { factor: 0.85, mode: 'moderate', text: 'Moderate readiness — same load, leave 2 reps in reserve, skip optional sets.' };
  return { factor: 1, mode: 'go', text: 'You\'re good. Train as planned.' };
}

// ---------------- Substitutions ----------------

export function substitutionsFor(exerciseId) {
  return (SUBSTITUTIONS[exerciseId] || []).map(id => EXERCISE_INDEX[id]).filter(Boolean);
}

// ---------------- Weekly review (local) ----------------

export function weeklyReview() {
  const s = S.get();
  const since = Date.now() - 7 * 86400000;
  const sessions = s.sessions.filter(x => new Date(x.date).getTime() >= since && x.status === 'done');
  const sets = s.sets.filter(x => sessions.some(ss => ss.id === x.sessionId) && x.type === 'working');
  const runs = s.runs.filter(r => new Date(r.date).getTime() >= since);

  // Volume per muscle = sum(weight × reps) grouped by primary muscle.
  const volByMuscle = {};
  for (const set of sets) {
    const ex = EXERCISE_INDEX[set.exerciseId];
    if (!ex) continue;
    const v = (set.weightKg || 0) * (set.reps || 0);
    volByMuscle[ex.primary] = (volByMuscle[ex.primary] || 0) + v;
  }
  const totalDistance = runs.reduce((a, r) => a + (r.distanceMeters || 0), 0);
  const totalDuration = runs.reduce((a, r) => a + (r.durationSeconds || 0), 0);

  return {
    sessions: sessions.length,
    sets: sets.length,
    volByMuscle,
    runs: runs.length,
    totalDistanceMeters: totalDistance,
    totalRunDuration: totalDuration,
  };
}

// ---------------- Adherence ----------------

export function adherenceLast(days = 28) {
  const s = S.get();
  const out = [];
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const k = dayKey(d);
    const ses = s.sessions.find(ss => dayKey(ss.date) === k && (ss.status === 'done' || ss.status === 'skipped'));
    const run = s.runs.find(r => dayKey(r.date) === k);
    out.push({
      date: k,
      day: d.getDay(),
      status: ses?.status === 'done' ? 'done' : (run ? 'partial' : (ses?.status === 'skipped' ? 'rest' : 'none')),
      hasRun: !!run,
    });
  }
  return out;
}

// ---------------- e1RM trend for one exercise ----------------

export function e1RMSeries(exerciseId, limit = 30) {
  const sets = S.setsForExercise(exerciseId).filter(s => s.type === 'working');
  // Best e1RM per session.
  const bySession = new Map();
  for (const s of sets) {
    const e = e1RM(s.weightKg || 0, s.reps || 0);
    if (!bySession.has(s.sessionId) || bySession.get(s.sessionId).e1 < e) {
      bySession.set(s.sessionId, { date: s.createdAt, e1: e });
    }
  }
  return Array.from(bySession.values()).slice(-limit);
}
