// DUP (Daily Undulating Periodization) and Block options for the mesocycle engine.
// Returns a per-day rep-range modifier so the same exercise rotates rep targets across the week.

import * as S from './state.js';

// Returns { repLow, repHigh, weightMultiplier } based on today's dayIndex (Mon=0).
export function dupForDay(dayIndex, slot) {
  const profiles = [
    { repLow: 5,  repHigh: 8,  weightMultiplier: 1.10, label: 'Strength (heavy)' }, // Mon
    { repLow: 8,  repHigh: 12, weightMultiplier: 1.00, label: 'Hypertrophy' },      // Tue
    { repLow: 12, repHigh: 15, weightMultiplier: 0.85, label: 'Volume (light)' },   // Wed
    { repLow: 6,  repHigh: 10, weightMultiplier: 1.05, label: 'Strength-Hyp' },     // Thu
    { repLow: 8,  repHigh: 12, weightMultiplier: 1.00, label: 'Hypertrophy' },      // Fri
    { repLow: 12, repHigh: 15, weightMultiplier: 0.85, label: 'Volume (light)' },   // Sat
    { repLow: 8,  repHigh: 12, weightMultiplier: 1.00, label: 'Hypertrophy' },      // Sun
  ];
  const p = profiles[dayIndex % 7];
  // Constrain inside the slot's planned rep band when possible.
  return {
    repLow: Math.max(p.repLow, slot.repLow - 2),
    repHigh: Math.min(p.repHigh, slot.repHigh + 3),
    weightMultiplier: p.weightMultiplier,
    label: p.label,
  };
}

// Block periodization: 3 weeks volume → 2 weeks intensity → 1 week deload, repeating.
export function blockForWeek(weekNum) {
  const cycleWeek = ((weekNum - 1) % 6) + 1;
  if (cycleWeek <= 3) return { phase: 'volume', repShift: +2, weightMultiplier: 0.92 };
  if (cycleWeek <= 5) return { phase: 'intensity', repShift: -2, weightMultiplier: 1.05 };
  return { phase: 'deload', repShift: 0, weightMultiplier: 0.7 };
}

// Apply the current periodization style to a slot. Returns a modified slot for prescription.
export function applyPeriodization(slot, dayIndex = 0, mesoWeek = 1) {
  const style = S.get().periodizationStyle || 'linear';
  if (style === 'dup') {
    const dup = dupForDay(dayIndex, slot);
    return { ...slot, repLow: dup.repLow, repHigh: dup.repHigh, _periodization: dup };
  }
  if (style === 'block') {
    const block = blockForWeek(mesoWeek);
    return {
      ...slot,
      repLow: Math.max(3, slot.repLow + block.repShift),
      repHigh: Math.max(slot.repLow + block.repShift + 2, slot.repHigh + block.repShift),
      _periodization: block,
    };
  }
  return slot;
}
