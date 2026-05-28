// Volume-per-muscle accounting + MEV/MAV/MRV band classification.
import * as S from './state.js';
import { MUSCLE_STIMULUS, VOLUME_LANDMARKS } from './volume-data.js';

// Return { muscle: fractionalSets } for the last N days (default 7).
// Custom exercises with no stimulus map are credited to their `primary` muscle at weight 1.0
// so they still appear in the dashboard.
export function volumeByMuscle(days = 7) {
  const s = S.get();
  const since = Date.now() - days * 86400000;
  const result = {};
  for (const set of s.sets) {
    if (set.type !== 'working') continue;
    if (new Date(set.createdAt).getTime() < since) continue;
    let stim = MUSCLE_STIMULUS[set.exerciseId];
    if (!stim) {
      // Derive from the exercise's own primary/secondary (covers home + custom exercises).
      const ex = S.getExercise(set.exerciseId);
      if (ex?.primary) {
        stim = { [ex.primary]: 1.0 };
        for (const sec of (ex.secondary || [])) stim[sec] = (stim[sec] || 0) + 0.5;
      } else continue;
    }
    for (const [muscle, weight] of Object.entries(stim)) {
      result[muscle] = (result[muscle] || 0) + weight;
    }
  }
  return result;
}

// Return { muscle: { sets, band: 'under' | 'mev' | 'mav' | 'mrv-zone' | 'over', landmark } }
export function volumeStatus(days = 7) {
  const vol = volumeByMuscle(days);
  const s = S.get();
  const out = {};
  const muscles = Object.keys(VOLUME_LANDMARKS);
  for (const m of muscles) {
    const sets = vol[m] || 0;
    const lm = { ...VOLUME_LANDMARKS[m], ...(s.customVolumeLandmarks?.[m] || {}) };
    let band = 'under';
    if (sets >= lm.mrv) band = 'over';
    else if (sets >= lm.mav) band = 'mrv-zone';
    else if (sets >= lm.mev) band = 'mav';
    else if (sets > 0) band = 'mev';
    out[m] = { sets: Math.round(sets * 10) / 10, band, landmark: lm };
  }
  return out;
}

// Planned weekly sets per muscle for the active program (without logs).
export function plannedVolumeByMuscle(weekType) {
  const s = S.get();
  const prog = s.programs[weekType || s.schedule.currentWeekType];
  if (!prog) return {};
  const result = {};
  for (const day of prog.days) {
    for (const slot of (day.slots || [])) {
      const stim = MUSCLE_STIMULUS[slot.exerciseId];
      if (!stim) continue;
      for (const [muscle, w] of Object.entries(stim)) {
        result[muscle] = (result[muscle] || 0) + w * slot.sets;
      }
    }
  }
  return result;
}

// Top under-volumed muscles (vs MAV-low). Useful for "specialization" suggestions.
export function underVolumedMuscles(days = 7) {
  const status = volumeStatus(days);
  return Object.entries(status)
    .filter(([m, x]) => x.sets < x.landmark.mev)
    .map(([m, x]) => ({ muscle: m, gap: x.landmark.mev - x.sets, sets: x.sets, mev: x.landmark.mev }))
    .sort((a, b) => b.gap - a.gap);
}

export function overVolumedMuscles(days = 7) {
  const status = volumeStatus(days);
  return Object.entries(status)
    .filter(([m, x]) => x.sets > x.landmark.mrv)
    .map(([m, x]) => ({ muscle: m, excess: x.sets - x.landmark.mrv, sets: x.sets, mrv: x.landmark.mrv }))
    .sort((a, b) => b.excess - a.excess);
}
