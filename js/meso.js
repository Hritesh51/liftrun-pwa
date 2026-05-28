// Mesocycle engine — 4-6 week arcs that ramp volume + intensity, then deload.
import * as S from './state.js';
import { plannedVolumeByMuscle } from './volume.js';
import { daysBetween } from './util.js';

/**
 * @typedef {{ active: boolean, currentWeek: number, lengthWeeks: number, isDeloadWeek: boolean, multiplier: number, startedAt: string|null }} MesoState
 */
/** A safe "off" state — numeric fields default so callers never hit undefined. */
function mesoOff() {
  return /** @type {MesoState} */ ({ active: false, currentWeek: 0, lengthWeeks: 0, isDeloadWeek: false, multiplier: 1, startedAt: null });
}

/** @returns {MesoState} */
export function mesoState() {
  const s = S.get();
  const m = s.mesoConfig || {};
  // Hard guards: must be enabled with a valid startedAt and sane length.
  if (!m.enabled || !m.startedAt) return mesoOff();
  const lengthWeeks = Number.isFinite(m.lengthWeeks) && m.lengthWeeks > 0 ? m.lengthWeeks : 5;
  const baseMult = Number.isFinite(m.baseVolumeMultiplier) ? m.baseVolumeMultiplier : 0.85;
  const peakMult = Number.isFinite(m.peakVolumeMultiplier) ? m.peakVolumeMultiplier : 1.10;
  let weeksIn;
  try { weeksIn = Math.floor(daysBetween(m.startedAt, new Date()) / 7); }
  catch { return mesoOff(); }
  if (!Number.isFinite(weeksIn) || weeksIn < 0) return mesoOff();
  const currentWeek = Math.min(lengthWeeks, weeksIn + 1);
  const isDeloadWeek = currentWeek >= lengthWeeks;
  const progress = (currentWeek - 1) / Math.max(1, lengthWeeks - 2);
  const multiplier = isDeloadWeek
    ? 0.55
    : baseMult + (peakMult - baseMult) * Math.min(1, Math.max(0, progress));
  // Final sanity check — if any value is bad, just disable.
  if (!Number.isFinite(currentWeek) || !Number.isFinite(multiplier)) return mesoOff();
  return {
    active: true,
    currentWeek,
    lengthWeeks,
    isDeloadWeek,
    multiplier: Math.round(multiplier * 100) / 100,
    startedAt: m.startedAt,
  };
}

// Should a working-set count be scaled this week? Returns a scalar 0.5–1.2.
export function setCountScalar() {
  const m = mesoState();
  return m.active ? m.multiplier : 1.0;
}

// Suggest the next mesocycle focus based on past volume.
export function suggestSpecialization() {
  // Pick the lagging muscle from last meso's planned vs landmarks
  const planned = plannedVolumeByMuscle();
  const out = [];
  for (const [muscle, sets] of Object.entries(planned)) {
    if (sets < 8) out.push({ muscle, plannedSets: Math.round(sets * 10) / 10 });
  }
  out.sort((a, b) => a.plannedSets - b.plannedSets);
  return out.slice(0, 3);
}
