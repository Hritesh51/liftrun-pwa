// Plate calculator. Given a target loaded barbell weight + bar weight + plate inventory,
// returns the minimal plates per side.
// Common gym inventory (kg): 25, 20, 15, 10, 5, 2.5, 1.25, 0.5.

export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
export const DEFAULT_PLATES_LB = [45, 35, 25, 10, 5, 2.5, 1.25];
export const DEFAULT_BAR_KG = 20;
export const DEFAULT_BAR_LB = 45;

export function plateBreakdown(targetWeight, barWeight = DEFAULT_BAR_KG, plates = DEFAULT_PLATES_KG) {
  if (!targetWeight || targetWeight < barWeight) {
    return { feasible: false, error: `Target ${targetWeight} below bar ${barWeight}` };
  }
  let perSide = (targetWeight - barWeight) / 2;
  if (perSide < 0) return { feasible: false, error: 'Negative weight per side' };
  const used = []; // array of plate values
  const remaining = perSide;
  let left = remaining;
  for (const p of plates.sort((a, b) => b - a)) {
    while (left + 1e-9 >= p) {
      used.push(p);
      left -= p;
    }
  }
  return {
    feasible: left < 0.1,
    perSidePlates: used,
    perSideKg: perSide,
    leftover: Math.round(left * 100) / 100,
    barWeight,
    targetWeight,
  };
}

// Tries closest-achievable if exact not possible.
export function closestAchievable(targetWeight, barWeight, plates) {
  // Exact first (skip sign permutation at delta=0).
  const exact = plateBreakdown(targetWeight, barWeight, plates);
  if (exact.feasible && (exact.leftover ?? 1) < 0.05) return exact;
  for (const delta of [0.5, 1.25, 2.5, 5]) {
    for (const sign of [-1, 1]) {
      const candidate = targetWeight + sign * delta;
      const r = plateBreakdown(candidate, barWeight, plates);
      if (r.feasible && (r.leftover ?? 1) < 0.05) return r;
    }
  }
  return exact;
}
