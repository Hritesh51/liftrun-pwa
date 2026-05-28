// Concurrent training stress: lifting volume × RPE + running TSS-style load.
import * as S from './state.js';

// Tonnage-RPE for last N days (rough hypertrophy stress proxy).
export function liftingLoad(days = 7) {
  const s = S.get();
  const since = Date.now() - days * 86400000;
  let load = 0;
  for (const set of s.sets) {
    if (set.type !== 'working') continue;
    if (new Date(set.createdAt).getTime() < since) continue;
    const rpe = set.rpe || 7;
    load += (set.weightKg || 0) * (set.reps || 0) * (rpe / 10);
  }
  return Math.round(load);
}

// Running "stress" (TSS-ish without HR/pace zones): duration × intensity multiplier.
// If no HR/pace data, default intensity = 0.7 (assume Zone 2).
export function runningLoad(days = 7) {
  const s = S.get();
  const since = Date.now() - days * 86400000;
  let load = 0;
  for (const run of s.runs) {
    if (new Date(run.date).getTime() < since) continue;
    const minutes = (run.durationSeconds || 0) / 60;
    const intensity = run.intensity || 0.7;
    load += minutes * intensity * 10;
  }
  return Math.round(load);
}

// Combined stress score 0..100. Honest but rough — used as a visual indicator.
export function combinedStress(days = 7) {
  const lift = liftingLoad(days);
  const run = runningLoad(days);
  // Calibrate roughly: 5000 lifting + 500 running = 100 for a beginner.
  const score = Math.min(100, Math.round((lift / 5000) * 70 + (run / 500) * 30));
  return { lift, run, score, level: score < 40 ? 'low' : score < 70 ? 'moderate' : score < 90 ? 'high' : 'overreaching' };
}

// Was last leg session impaired by recent running?
export function legImpactWarning() {
  const s = S.get();
  const lastLeg = s.sessions.find(x => x.status === 'done' && /leg/i.test(x.dayLabel || ''));
  if (!lastLeg) return null;
  const since = new Date(lastLeg.date).getTime() - 2 * 86400000;
  const until = new Date(lastLeg.date).getTime();
  const hardRunBefore = s.runs.find(r => {
    const t = new Date(r.date).getTime();
    return t >= since && t <= until && (r.distanceMeters || 0) > 5000;
  });
  if (!hardRunBefore) return null;
  // Did the leg session have failed sets or below-floor reps?
  const legSets = s.sets.filter(x => x.sessionId === lastLeg.id && x.type === 'working');
  const failedOrFloor = legSets.some(x => x.type === 'failure' || x.rpe >= 9);
  if (failedOrFloor) {
    return { lastLeg, run: hardRunBefore, message: 'Your last leg day had high RPE / failed sets after a hard run in the prior 2 days. Consider easier runs before legs.' };
  }
  return null;
}
