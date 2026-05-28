// Home training engine: resolve a movement-pattern slot to the best available exercise at the
// user's current ladder position, and progress UP the ladder when reps are capped.
import * as S from './state.js';
import { HOME_INDEX, LADDERS, HOME_PROGRAMS, HOME_EXERCISES } from './home-data.js';

// What equipment does the user have? Returns a Set of ids (bodyweight + chair always available).
export function userEquipment() {
  const s = S.get();
  const eq = new Set(['bodyweight', 'chair']);
  for (const [k, v] of Object.entries(s.equipment || {})) {
    if (v) eq.add(k);
  }
  return eq;
}

// Can the user perform this exercise with their equipment?
export function canDo(exercise) {
  const eq = userEquipment();
  return (exercise.equipment || []).every(req => eq.has(req));
}

// Filter a ladder to exercises the user can actually do, preserving order.
export function availableLadder(pattern) {
  const ladder = LADDERS[pattern] || [];
  return ladder.map(id => HOME_INDEX[id]).filter(ex => ex && canDo(ex));
}

// The user's current position in a pattern's ladder (defaults to the easiest available).
export function currentLevel(pattern) {
  const s = S.get();
  const saved = s.homeLadderPos?.[pattern];
  const ladder = availableLadder(pattern);
  if (!ladder.length) return null;
  if (saved) {
    const found = ladder.find(ex => ex.id === saved);
    if (found) return found;
  }
  return ladder[0];
}

// If a pattern can't be trained with the user's equipment, fall back to a related pattern
// that hits a similar muscle group and is more likely to be bodyweight-available.
const FALLBACK_PATTERN = {
  'v-pull': 'h-pull',     // no bar/bands → do horizontal rows (doorway/table)
  'v-push': 'h-push',     // → push-up variants
  'side-delt': 'v-push',  // shoulders
  'biceps': 'h-pull',     // pulls train biceps
  'triceps': 'h-push',    // pushes train triceps (+ bench dip on a chair)
  'h-pull': 'v-pull',
  'hinge': 'squat',
};

// Resolve a program slot (which references a pattern) to a concrete exercise + rep target.
export function resolveSlot(slot) {
  // Some UL slots use a "-ph" placeholder pattern; map those back to base patterns.
  const pattern = slot.pattern.replace(/-ph$/, '').replace('q-bulgarian', 'squat');
  let ex = currentLevel(pattern);
  let resolvedPattern = pattern;
  // Equipment gap → try the fallback pattern.
  if (!ex && FALLBACK_PATTERN[pattern]) {
    const fb = FALLBACK_PATTERN[pattern];
    const fbEx = currentLevel(fb);
    if (fbEx) { ex = fbEx; resolvedPattern = fb; }
  }
  if (!ex) return { exercise: null, pattern, slot }; // truly untrainable — caller drops it
  return { exercise: ex, pattern: resolvedPattern, slot: { ...slot, exerciseId: ex.id, pattern: resolvedPattern } };
}

// Suggest next set for a HOME exercise. Two-axis progression:
//  1) If maxed top-of-range reps on all sets → move UP the ladder, reset reps.
//  2) Else add reps (double progression within the variation).
export function homeSuggest(exercise, slot, lastSets) {
  const pattern = exercise.pattern;
  const ladder = availableLadder(pattern);
  const idx = ladder.findIndex(e => e.id === exercise.id);
  const hasHarder = idx >= 0 && idx < ladder.length - 1;

  if (!lastSets || !lastSets.length) {
    return {
      exerciseId: exercise.id, reps: slot.repLow, sets: slot.sets, rpeCap: 8,
      note: `Aim for ${slot.repLow}–${slot.repHigh} clean reps. Stop 1–2 short of failure.`,
      basis: 'first-time',
    };
  }
  const working = lastSets.filter(s => s.type === 'working');
  const minReps = Math.min(...working.map(s => s.reps || 0));
  const allHitTop = working.length >= slot.sets && minReps >= slot.repHigh;

  if (allHitTop && hasHarder) {
    const next = ladder[idx + 1];
    return {
      exerciseId: exercise.id, reps: slot.repHigh, sets: slot.sets, rpeCap: 8,
      ladderUp: next.id, ladderUpName: next.name,
      note: `You capped ${slot.repHigh} reps on every set — time to level up to "${next.name}". Tap to switch; reps reset to ${slot.repLow}.`,
      basis: 'ladder-up',
    };
  }
  if (allHitTop && !hasHarder) {
    return {
      exerciseId: exercise.id, reps: slot.repHigh + 2, sets: slot.sets + 1, rpeCap: 9,
      note: `Top of the ladder — add reps + a set, slow your tempo (3s eccentric), and add load (backpack/vest) if you can.`,
      basis: 'ladder-top',
    };
  }
  return {
    exerciseId: exercise.id, reps: Math.min(slot.repHigh, minReps + 1), sets: slot.sets, rpeCap: 8,
    note: `Add one rep per set until you hit ${slot.repHigh} everywhere, then you'll level up.`,
    basis: 'add-reps',
  };
}

// Move the user up the ladder for a pattern.
export function ladderUp(pattern, newExerciseId) {
  S.update(s => {
    s.homeLadderPos = s.homeLadderPos || {};
    s.homeLadderPos[pattern] = newExerciseId;
  });
}
export function setLadderPos(pattern, exerciseId) { ladderUp(pattern, exerciseId); }

// Move DOWN a level (regress) if the current variation is too hard.
export function ladderDown(pattern) {
  const ladder = availableLadder(pattern);
  const cur = currentLevel(pattern);
  if (!cur) return null;
  const idx = ladder.findIndex(e => e.id === cur.id);
  if (idx > 0) {
    const prev = ladder[idx - 1];
    setLadderPos(pattern, prev.id);
    return prev;
  }
  return null;
}

// Position info for visualization: { index, total, current, next, prev, ladder }.
export function ladderInfo(pattern) {
  const ladder = availableLadder(pattern);
  const cur = currentLevel(pattern);
  if (!cur || !ladder.length) return null;
  const idx = ladder.findIndex(e => e.id === cur.id);
  return {
    index: idx, total: ladder.length, current: cur,
    next: idx < ladder.length - 1 ? ladder[idx + 1] : null,
    prev: idx > 0 ? ladder[idx - 1] : null,
    ladder,
  };
}

// Get the active home program object.
export function homeProgram() {
  const s = S.get();
  const id = s.homeProgramId || 'HOME_FB';
  return HOME_PROGRAMS[id] || HOME_PROGRAMS.HOME_FB;
}

// Returns a fully-resolved home day (concrete exercises) for rendering.
// Slots that can't be trained with the user's equipment are DROPPED (never rendered blank).
// Duplicate exercises (after fallback collapsing) are de-duped so the day stays varied.
export function resolveHomeDay(day) {
  const used = new Set();
  const slots = [];
  for (const sl of (day.slots || [])) {
    const r = resolveSlot(sl);
    if (!r.exercise) continue;            // untrainable with current equipment → skip the slot
    let ex = r.exercise;
    // Avoid repeating the same exercise within one day — pick a different doable
    // variation of the same (resolved) pattern for variety.
    if (used.has(ex.id)) {
      // Prefer the current-level's neighbours first (ladder), then any doable same-pattern move.
      const ladderAlt = availableLadder(r.pattern).find(e => !used.has(e.id));
      const anyAlt = HOME_EXERCISES.find(e => e.pattern === r.pattern && canDo(e) && !used.has(e.id));
      const alt = ladderAlt || anyAlt;
      if (alt) ex = alt;
    }
    used.add(ex.id);
    slots.push({ ...sl, exerciseId: ex.id, pattern: r.pattern });
  }
  return { ...day, slots };
}

// Zero-equipment emergency session — full-body, bodyweight only, ~15 min.
// Returns a synthetic day object the workout screen can run.
export function zeroEquipmentSession() {
  const patterns = ['squat', 'h-push', 'h-pull', 'hinge', 'core'];
  const slots = patterns.map(p => {
    // Force the bodyweight-only ladder entry (ignore owned equipment).
    const ladder = (LADDERS[p] || []).map(id => HOME_INDEX[id]).filter(ex => ex && (ex.equipment || []).every(r => r === 'bodyweight' || r === 'chair'));
    const ex = ladder[Math.min(1, ladder.length - 1)] || ladder[0]; // 2nd-easiest if available
    return ex ? { pattern: p, exerciseId: ex.id, sets: 3, repLow: 10, repHigh: 20, restSec: 45 } : null;
  }).filter(Boolean);
  return { id: 'zero-equip-' + Date.now(), name: 'Quick Bodyweight', slots, zeroEquip: true };
}

// Equipment readiness: how many patterns are trainable?
export function equipmentCoverage() {
  const patterns = Object.keys(LADDERS);
  let covered = 0;
  for (const p of patterns) if (availableLadder(p).length) covered++;
  return { covered, total: patterns.length };
}
