// Adherence pattern detection — find the day-of-week the user tends to skip,
// detect streaks, and propose smart re-engagement.
import * as S from './state.js';
import { dayKey } from './util.js';

export function currentStreak() {
  const s = S.get();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const k = dayKey(d);
    const session = s.sessions.find(x => dayKey(x.date) === k && x.status === 'done');
    const run = s.runs.find(r => dayKey(r.date) === k);
    if (session || run) streak++;
    else if (i === 0) continue; // allow today to be open
    else break;
  }
  return streak;
}

export function bestStreak() {
  const s = S.get();
  const dates = new Set();
  s.sessions.filter(x => x.status === 'done').forEach(x => dates.add(dayKey(x.date)));
  s.runs.forEach(r => dates.add(dayKey(r.date)));
  const sorted = Array.from(dates).sort();
  let best = 0, cur = 0, prev = null;
  for (const d of sorted) {
    if (prev) {
      const diff = (new Date(d).getTime() - new Date(prev).getTime()) / 86400000;
      cur = diff <= 1.5 ? cur + 1 : 1;
    } else cur = 1;
    if (cur > best) best = cur;
    prev = d;
  }
  return best;
}

// Detect: which day of week has the user skipped most often in last 8 weeks?
export function skipPattern() {
  const s = S.get();
  const since = Date.now() - 56 * 86400000;
  const planned = {}; const done = {}; // by day-of-week 0-6
  for (const x of s.sessions) {
    if (new Date(x.date).getTime() < since) continue;
    const dow = new Date(x.date).getDay();
    planned[dow] = (planned[dow] || 0) + 1;
    if (x.status === 'done') done[dow] = (done[dow] || 0) + 1;
  }
  const out = [];
  for (let i = 0; i < 7; i++) {
    const p = planned[i] || 0, d = done[i] || 0;
    if (p >= 3) {
      const skipRate = (p - d) / p;
      if (skipRate > 0.4) out.push({ dow: i, dayName: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i], skipRate: Math.round(skipRate * 100), planned: p, done: d });
    }
  }
  return out.sort((a, b) => b.skipRate - a.skipRate);
}

// Days since last logged activity.
export function daysSinceLast() {
  const s = S.get();
  const lastSet = s.sets[s.sets.length - 1];
  const lastRun = s.runs[0];
  let last = 0;
  if (lastSet) last = Math.max(last, new Date(lastSet.createdAt).getTime());
  if (lastRun) last = Math.max(last, new Date(lastRun.date).getTime());
  if (!last) return null;
  return Math.floor((Date.now() - last) / 86400000);
}
