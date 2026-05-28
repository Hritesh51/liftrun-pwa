// Auto-regulated load. Wraps suggestNextSet with day-of adjustments based on
// (a) today's readiness factor, (b) yesterday's RPE/failure pattern.
import * as S from './state.js';
import { suggestNextSet } from './engine.js';
import { todaysFactor } from './readiness.js';
import { roundTo } from './util.js';

export function autoRegSuggestion(exerciseId, slot) {
  const base = suggestNextSet(exerciseId, slot);
  if (!base) return base;
  const factor = todaysFactor(); // 0.7–1.05
  const lastSession = S.lastSessionWith(exerciseId);
  let yesterdayPenalty = 0;
  let note = base.note;

  if (lastSession) {
    const sets = lastSession.sets.filter(s => s.type === 'working');
    if (sets.length) {
      const avgRPE = sets.reduce((a, s) => a + (s.rpe || 7), 0) / sets.length;
      if (avgRPE >= 9.5) { yesterdayPenalty = 0.95; note += ' · Yesterday was max-effort — easing back ~5%.'; }
      else if (avgRPE >= 9)  { yesterdayPenalty = 0.97; }
      else if (avgRPE <= 6.5) { yesterdayPenalty = 1.03; note += ' · Last session was sub-maximal — pushing slightly.'; }
    }
  }

  const totalFactor = factor * (yesterdayPenalty || 1.0);
  const weightKg = base.weightKg != null ? roundTo(base.weightKg * totalFactor, 2.5) : null;
  let readinessNote = '';
  if (factor < 0.8) readinessNote = ` · Readiness low (×${factor.toFixed(2)}) — pulled load back.`;
  else if (factor > 1.02) readinessNote = ` · Readiness primed (×${factor.toFixed(2)}) — small bump.`;

  return {
    ...base,
    weightKg,
    note: note + readinessNote,
    autoRegFactor: Math.round(totalFactor * 100) / 100,
    basis: base.basis + (totalFactor !== 1 ? '+autoreg' : ''),
  };
}
