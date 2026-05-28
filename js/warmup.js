// Ramped warm-up set generator for a working set.
// Standard recipe for hypertrophy: 2–3 ramped sets at decreasing rep counts.
import { roundTo } from './util.js';

export function warmupSets(workingWeightKg, options = {}) {
  if (!workingWeightKg || workingWeightKg < 5) return []; // light enough to skip
  const step = options.barStep || 2.5;
  const isHeavy = workingWeightKg >= 40;
  // For lighter lifts, 1 warm-up. For heavier, 2–3.
  const sets = [];
  if (isHeavy) {
    sets.push({ weightKg: roundTo(workingWeightKg * 0.45, step), reps: 8, rpe: 5, note: 'Empty bar / very light' });
    sets.push({ weightKg: roundTo(workingWeightKg * 0.65, step), reps: 5, rpe: 6, note: 'Build feel' });
    sets.push({ weightKg: roundTo(workingWeightKg * 0.85, step), reps: 3, rpe: 7, note: 'Primer' });
  } else if (workingWeightKg >= 20) {
    sets.push({ weightKg: roundTo(workingWeightKg * 0.5, step), reps: 8, rpe: 5, note: 'Light, focus on form' });
    sets.push({ weightKg: roundTo(workingWeightKg * 0.75, step), reps: 4, rpe: 6, note: 'Primer' });
  } else {
    sets.push({ weightKg: roundTo(workingWeightKg * 0.6, step), reps: 8, rpe: 5, note: 'One easy primer' });
  }
  return sets;
}

// General primer (non-exercise-specific) — used at the very top of a session.
export function sessionPrimer(dayName = 'Push') {
  const isLegs = /leg/i.test(dayName);
  return isLegs
    ? ['5 min easy bike/row to raise core temp', 'Glute bridges × 10', 'Bodyweight squats × 10 slow', 'Air-RDLs × 10 — feel the hamstrings']
    : /pull|back/i.test(dayName)
      ? ['5 min easy bike/row', 'Band pull-aparts × 15', 'Scapular pull-ups × 8 (or dead-hangs)', 'Cat–cow × 8']
      : ['5 min easy bike/row', 'Band pull-aparts × 15', 'Push-ups × 10 slow', 'Arm circles × 10 each direction'];
}
