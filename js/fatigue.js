// Fatigue / RPE-creep / failure detection → smart deload trigger.
// Pure functions. Read from state, return analyses.
import * as S from './state.js';
import { e1RM } from './util.js';

// Per-exercise: detect rising RPE at same/similar load over recent sessions.
export function rpeCreepFlags() {
  const s = S.get();
  const byEx = {};
  for (const set of s.sets) {
    if (set.type !== 'working' || !set.rpe || !set.weightKg) continue;
    (byEx[set.exerciseId] = byEx[set.exerciseId] || []).push(set);
  }
  const flags = [];
  for (const [ex, sets] of Object.entries(byEx)) {
    if (sets.length < 6) continue;
    const recent = sets.slice(-6);
    // Group by similar weight (±5%)
    const byWeight = new Map();
    for (const s of recent) {
      const key = Math.round(s.weightKg / 2.5) * 2.5;
      if (!byWeight.has(key)) byWeight.set(key, []);
      byWeight.get(key).push(s.rpe);
    }
    for (const [w, rpes] of byWeight.entries()) {
      if (rpes.length < 3) continue;
      const trend = rpes[rpes.length - 1] - rpes[0];
      if (trend >= 1.5) flags.push({ exerciseId: ex, weightKg: w, rpeStart: rpes[0], rpeEnd: rpes[rpes.length - 1] });
    }
  }
  return flags;
}

// Count failed reps (set type = 'failure' or reps below floor) in the last N days.
export function failureCount(days = 14) {
  const s = S.get();
  const since = Date.now() - days * 86400000;
  return s.sets.filter(x =>
    x.type === 'failure' &&
    new Date(x.createdAt).getTime() >= since
  ).length;
}

// Performance regression: e1RM trend per exercise. Returns exercises that dropped.
export function regressedExercises(days = 21) {
  const s = S.get();
  const since = Date.now() - days * 86400000;
  const byEx = {};
  for (const set of s.sets) {
    if (set.type !== 'working') continue;
    if (new Date(set.createdAt).getTime() < since) continue;
    const e = e1RM(set.weightKg || 0, set.reps || 0);
    if (!byEx[set.exerciseId]) byEx[set.exerciseId] = [];
    byEx[set.exerciseId].push({ date: set.createdAt, e });
  }
  const regressed = [];
  for (const [ex, arr] of Object.entries(byEx)) {
    if (arr.length < 4) continue;
    arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const halfway = Math.floor(arr.length / 2);
    const earlyMax = Math.max(...arr.slice(0, halfway).map(x => x.e));
    const recentMax = Math.max(...arr.slice(halfway).map(x => x.e));
    if (recentMax < earlyMax * 0.95) {
      regressed.push({ exerciseId: ex, earlyMax, recentMax, dropPct: Math.round((1 - recentMax / earlyMax) * 100) });
    }
  }
  return regressed;
}

// Aggregate signal: should we deload now?
export function smartDeloadSignal() {
  const creep = rpeCreepFlags();
  const fails = failureCount(14);
  const regressed = regressedExercises(21);
  const score =
    creep.length * 2 +
    fails +
    regressed.length * 3;
  const triggered = score >= 5 || regressed.length >= 2;
  const reasons = [];
  if (creep.length) reasons.push(`${creep.length} exercise${creep.length > 1 ? 's' : ''} with rising RPE at same load`);
  if (fails) reasons.push(`${fails} failed set${fails > 1 ? 's' : ''} in last 14 days`);
  if (regressed.length) reasons.push(`${regressed.length} exercise${regressed.length > 1 ? 's' : ''} regressing`);
  return { triggered, score, reasons, creep, fails, regressed };
}

// Auto exercise rotation: if an exercise has been used >6 weeks without rotation, flag it.
export function staleExercises(weeks = 6) {
  const s = S.get();
  const cutoff = Date.now() - weeks * 7 * 86400000;
  const out = [];
  for (const [ex, info] of Object.entries(s.exerciseRotation || {})) {
    const firstUsed = info.firstUsed ? new Date(info.firstUsed).getTime() : null;
    const lastRotated = info.lastRotated ? new Date(info.lastRotated).getTime() : firstUsed;
    if (lastRotated && lastRotated < cutoff) {
      out.push({ exerciseId: ex, weeksSinceRotation: Math.floor((Date.now() - lastRotated) / (7 * 86400000)) });
    }
  }
  // Also mark exercises with regressed e1RM as candidates for rotation
  const reg = regressedExercises(28);
  for (const r of reg) {
    if (!out.find(x => x.exerciseId === r.exerciseId)) {
      out.push({ exerciseId: r.exerciseId, reason: 'regression', dropPct: r.dropPct });
    }
  }
  return out;
}
