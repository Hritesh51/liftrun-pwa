// Cumulative joint loading from logged working sets over a rolling window.
// Maps exercises → joints they stress, sums weighted load, flags excursions.
import * as S from './state.js';

const JOINT_MAP = {
  'chest-press':        { shoulder: 0.7, elbow: 0.5 },
  'incline-db-press':   { shoulder: 0.8, elbow: 0.4 },
  'machine-shoulder-press': { shoulder: 1.0, elbow: 0.4 },
  'lateral-raise':      { shoulder: 0.6 },
  'tri-pushdown':       { elbow: 0.7 },
  'overhead-tri':       { elbow: 0.8, shoulder: 0.3 },
  'dips':               { shoulder: 0.7, elbow: 0.7 },
  'cable-fly':          { shoulder: 0.7 },
  'lat-pulldown':       { shoulder: 0.5, elbow: 0.5 },
  'seated-row':         { shoulder: 0.4, elbow: 0.5, 'low-back': 0.2 },
  'chest-supported-row':{ shoulder: 0.4, elbow: 0.5 },
  'face-pull':          { shoulder: 0.5 },
  'biceps-curl':        { elbow: 0.6 },
  'hammer-curl':        { elbow: 0.6 },
  'pullover':           { shoulder: 0.7 },
  'leg-press':          { knee: 0.8, hip: 0.6, 'low-back': 0.2 },
  'goblet-squat':       { knee: 0.8, hip: 0.7, 'low-back': 0.3 },
  'rdl':                { hip: 0.9, 'low-back': 0.7, knee: 0.2 },
  'leg-extension':      { knee: 0.9 },
  'leg-curl':           { knee: 0.5 },
  'calf-raise':         { ankle: 0.7 },
  'ohp':                { shoulder: 1.0, elbow: 0.4, 'low-back': 0.3 },
  'rear-delt-fly':      { shoulder: 0.4 },
  'shrug':              { shoulder: 0.3, 'low-back': 0.2 },
  'plank':              { 'low-back': 0.4, shoulder: 0.3 },
  'hanging-knee-raise': { shoulder: 0.4 },
  'cable-crunch':       { 'low-back': 0.3 },
};

// Pattern → joints fallback for home/bodyweight exercises (which have a `pattern`, not a gym id).
const PATTERN_JOINTS = {
  'h-push':   { shoulder: 0.7, elbow: 0.5 },
  'v-push':   { shoulder: 1.0, elbow: 0.4 },
  'side-delt':{ shoulder: 0.5 },
  'h-pull':   { shoulder: 0.4, elbow: 0.5 },
  'v-pull':   { shoulder: 0.6, elbow: 0.5 },
  'squat':    { knee: 0.8, hip: 0.6, 'low-back': 0.2 },
  'hinge':    { hip: 0.9, 'low-back': 0.6, knee: 0.2 },
  'calf':     { ankle: 0.7 },
  'biceps':   { elbow: 0.6 },
  'triceps':  { elbow: 0.7, shoulder: 0.3 },
  'core':     { 'low-back': 0.3, shoulder: 0.2 },
};

export function jointLoad(days = 28) {
  const s = S.get();
  const since = Date.now() - days * 86400000;
  const result = {};
  for (const set of s.sets) {
    if (set.type !== 'working') continue;
    if (new Date(set.createdAt).getTime() < since) continue;
    let map = JOINT_MAP[set.exerciseId];
    if (!map) {
      // Home/bodyweight: use the exercise's pattern. Bodyweight load proxy = reps × bodyweight fraction.
      const ex = S.getExercise(set.exerciseId);
      if (ex?.pattern && PATTERN_JOINTS[ex.pattern]) map = PATTERN_JOINTS[ex.pattern];
      else continue;
    }
    // For bodyweight (weight 0), use a nominal load per rep so home work still registers.
    const load = (set.weightKg || 0) > 0 ? (set.weightKg * (set.reps || 0)) : (set.reps || 0) * 5;
    for (const [joint, w] of Object.entries(map)) {
      result[joint] = (result[joint] || 0) + load * w;
    }
  }
  return result;
}

// Warning: any joint where last 7d load > 4-week avg by > 35%.
export function jointWarnings() {
  const recent = jointLoad(7);
  const month = jointLoad(28);
  const warnings = [];
  for (const [joint, sevenDay] of Object.entries(recent)) {
    const monthAvg = (month[joint] || 0) / 4;
    if (monthAvg > 0 && sevenDay > monthAvg * 1.35) {
      warnings.push({
        joint,
        sevenDay: Math.round(sevenDay),
        monthAvg: Math.round(monthAvg),
        deltaPct: Math.round((sevenDay / monthAvg - 1) * 100),
      });
    }
  }
  return warnings.sort((a, b) => b.deltaPct - a.deltaPct);
}
