// Achievement engine. Pure-function checks against state. Returns unlocked badges + new ones since last check.
import * as S from './state.js';
import { currentStreak, bestStreak } from './streak.js';

export const BADGES = [
  // Streaks
  { id: 'streak-7',  name: 'Week-strong',        emoji: '🔥', desc: '7-day training streak.',                 check: () => currentStreak() >= 7 },
  { id: 'streak-30', name: 'Iron habit',         emoji: '🔥🔥', desc: '30-day training streak.',                check: () => bestStreak() >= 30 },
  { id: 'streak-100',name: 'Lifer',              emoji: '💯', desc: '100-day training streak.',                check: () => bestStreak() >= 100 },
  // Workouts
  { id: 'first-set', name: 'First set',          emoji: '🏋️', desc: 'Logged your first set.',                  check: () => S.get().sets.length >= 1 },
  { id: 'ten-sessions', name: 'Tenfold',         emoji: '🔟', desc: 'Completed 10 sessions.',                  check: () => S.get().sessions.filter(s => s.status === 'done').length >= 10 },
  { id: 'fifty-sessions',name:'Half a century',  emoji: '5️⃣0️⃣', desc: '50 completed sessions.',                check: () => S.get().sessions.filter(s => s.status === 'done').length >= 50 },
  // PRs
  { id: 'first-pr',  name: 'First PR',           emoji: '🏆', desc: 'First personal record.',                  check: () => Object.keys(S.get().prs || {}).length >= 1 },
  { id: 'ten-prs',   name: 'PR machine',         emoji: '🏆🏆', desc: '10 different exercises with PRs.',       check: () => Object.keys(S.get().prs || {}).length >= 10 },
  // Bench milestones (for the 63 kg user)
  { id: 'bench-bodyweight', name: 'Bench bodyweight', emoji: '⚖️', desc: 'Bench press = your bodyweight.',   check: () => {
    const bw = S.get().body[0]?.weightKg || 999;
    const pr = S.get().prs['chest-press']?.bestWeightKg || 0;
    return pr >= bw;
  }},
  // Running
  { id: 'first-run', name: 'First steps',        emoji: '🏃', desc: 'Logged your first run.',                  check: () => S.get().runs.length >= 1 },
  { id: 'fifty-km',  name: 'Half-century km',    emoji: '🏃‍♂️', desc: '50 km of total running.',               check: () => S.get().runs.reduce((a, r) => a + (r.distanceMeters || 0)/1000, 0) >= 50 },
  { id: 'first-5k',  name: 'Sub-25 5K',          emoji: '🥇', desc: '5K in under 25 minutes.',                 check: () => S.get().runs.some(r => r.distanceMeters >= 5000 && r.distanceMeters <= 5500 && r.durationSeconds <= 25*60) },
  // Health
  { id: 'movement-screen-done', name: 'Knows thyself', emoji: '🧘', desc: 'Took the movement screen.', check: () => !!S.get().movementScreen },
  { id: 'mobility-week', name: 'Limber',         emoji: '🌀', desc: '5 mobility sessions in 7 days.',          check: () => {
    const since = Date.now() - 7 * 86400000;
    return (S.get().mobilityDoneLog || []).filter(m => new Date(m.date).getTime() >= since).length >= 5;
  }},
  // Nutrition
  { id: 'first-meal-log', name: 'Eyes on food',  emoji: '📸', desc: 'Logged your first meal photo.',           check: () => S.get().mealLogs?.length >= 1 },
  { id: 'menu-uploaded', name: 'Mess sorted',    emoji: '🥗', desc: 'Uploaded a weekly menu.',                 check: () => S.get().weeklyMenus?.length >= 1 },
  // Recovery / consistency
  { id: 'first-readiness', name: 'Self-aware',   emoji: '🌅', desc: 'Logged your first daily readiness check-in.', check: () => S.get().dailyLogs?.length >= 1 },
  { id: 'seven-readiness', name: 'Watcher',      emoji: '👁️', desc: '7 daily readiness logs.',                check: () => S.get().dailyLogs?.length >= 7 },

  // ===== Home / bodyweight milestones =====
  { id: 'home-mode',      name: 'Home base',     emoji: '🏠', desc: 'Switched on home training.',           check: () => S.get().trainingMode === 'home' || Object.values(S.get().equipment || {}).some(Boolean) },
  { id: 'first-pullup',   name: 'First pull-up', emoji: '🆙', desc: 'Logged a real pull-up.',               check: () => repMax('v-pullup') >= 1 },
  { id: 'ten-pushups',    name: 'Ten clean',     emoji: '🔟', desc: '10+ full push-ups in one set.',         check: () => repMax('h-pushup') >= 10 },
  { id: 'twenty-pushups', name: 'Push machine',  emoji: '💪', desc: '20+ full push-ups in one set.',         check: () => repMax('h-pushup') >= 20 },
  { id: 'pistol-squat',   name: 'Pistol packer', emoji: '🦵', desc: 'Logged an unassisted pistol squat.',    check: () => repMax('q-pistol') >= 1 },
  { id: 'ladder-climb',   name: 'Ladder climber',emoji: '🪜', desc: 'Leveled up any difficulty ladder.',      check: () => Object.keys(S.get().homeLadderPos || {}).length >= 1 },
  { id: 'archer-pushup',  name: 'Archer',        emoji: '🏹', desc: 'Reached archer push-ups.',              check: () => !!(S.get().homeLadderPos?.['h-push'] === 'h-archer-pushup' || repMax('h-archer-pushup') >= 1) },
];

// Best reps logged for an exercise id (used by bodyweight achievements).
function repMax(exId) {
  const s = S.get();
  let best = 0;
  for (const set of s.sets) {
    if (set.exerciseId === exId && set.type === 'working') best = Math.max(best, set.reps || 0);
  }
  return best;
}

// Returns array of currently unlocked badge ids.
export function unlockedBadges() {
  return BADGES.filter(b => { try { return b.check(); } catch { return false; } }).map(b => b.id);
}

// Track which were seen — surface a celebration for newly unlocked ones since last call.
export function newlyUnlocked() {
  const s = S.get();
  const seen = new Set(s.user.seenBadges || []);
  const unlocked = unlockedBadges();
  const nu = unlocked.filter(id => !seen.has(id));
  if (nu.length) {
    S.update(state => { state.user.seenBadges = unlocked; });
  }
  return nu;
}

export function getBadge(id) { return BADGES.find(b => b.id === id); }
