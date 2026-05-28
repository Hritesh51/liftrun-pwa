// Daily readiness score from multi-signal inputs. 0-100. Drives today's load scaling.
// Inputs: sleep hours + quality, mood, energy, soreness, stress, optional HRV/RHR.
import * as S from './state.js';
import { clamp } from './util.js';

export function readinessFromDaily(log) {
  if (!log) return null;
  // Each contributes 0..20 to a 100-point score.
  const sleepH = clamp(log.sleepHours ?? 7, 0, 10);
  const sleepHScore = (sleepH / 8) * 18; // up to 18 (capped — too much is bad too)
  const sleepQ = clamp(log.sleepQuality ?? 3, 1, 5);
  const sleepQScore = ((sleepQ - 1) / 4) * 12; // up to 12
  const mood = clamp(log.mood ?? 3, 1, 5);
  const moodScore = ((mood - 1) / 4) * 18; // up to 18
  const energy = clamp(log.energy ?? 3, 1, 5);
  const energyScore = ((energy - 1) / 4) * 20; // up to 20 — most predictive
  const stress = clamp(log.stress ?? 3, 1, 5);
  const stressScore = ((5 - stress) / 4) * 12; // inverted — high stress reduces
  const soreness = clamp(log.soreness ?? 3, 1, 5);
  const sorenessScore = ((5 - soreness) / 4) * 10; // inverted

  // Optional HRV (Whoop/Garmin/etc.): if higher than user's 7-day baseline, bonus
  let hrvBonus = 0;
  if (Number.isFinite(log.hrvMs)) {
    const baseline = avgHRV(7);
    if (baseline && log.hrvMs > baseline * 1.05) hrvBonus = 5;
    else if (baseline && log.hrvMs < baseline * 0.85) hrvBonus = -8;
  }
  // Optional resting HR: elevated vs baseline = recovery debt
  let rhrPenalty = 0;
  if (Number.isFinite(log.restingHR)) {
    const base = avgRHR(7);
    if (base && log.restingHR > base * 1.07) rhrPenalty = -8;
  }

  let total = sleepHScore + sleepQScore + moodScore + energyScore + stressScore + sorenessScore + hrvBonus + rhrPenalty;
  total = clamp(Math.round(total), 0, 100);
  return total;
}

function avgHRV(days) {
  const s = S.get();
  const since = Date.now() - days * 86400000;
  const arr = s.dailyLogs.filter(d => new Date(d.date).getTime() >= since && Number.isFinite(d.hrvMs)).map(d => d.hrvMs);
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}
function avgRHR(days) {
  const s = S.get();
  const since = Date.now() - days * 86400000;
  const arr = s.dailyLogs.filter(d => new Date(d.date).getTime() >= since && Number.isFinite(d.restingHR)).map(d => d.restingHR);
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

// Recommendation derived from score.
export function readinessAdvice(score, pain = false) {
  if (pain) return { factor: 0, mode: 'pain', text: 'Pain reported — skip the lift today. Mobility / easy walk only. Sharp/persistent pain → see a professional.' };
  if (score < 35) return { factor: 0.7, mode: 'low', text: 'Low readiness — drop load ~15%, cut one set per exercise, stop with 3 reps in reserve.' };
  if (score < 55) return { factor: 0.9, mode: 'moderate', text: 'Moderate — same load, leave 2 reps in reserve, skip optional sets.' };
  if (score < 80) return { factor: 1.0, mode: 'good', text: 'Good readiness — train as planned.' };
  return { factor: 1.05, mode: 'primed', text: 'Primed — could push a top set today if you feel sharp.' };
}

// Get today's readiness factor (1.0 if no log).
export function todaysFactor() {
  const log = S.todaysDailyLog();
  if (!log) return 1.0;
  const score = readinessFromDaily(log);
  return readinessAdvice(score, log.pain).factor;
}
