// Smart notifications — schedules local notifications based on the user's program + nudges config.
// On iOS PWA, notifications fire only if (a) permission granted, (b) the app is installed via Add-to-Home-Screen, (c) iOS 16.4+.
// We use UserNotifications via the service worker. Since web doesn't have true scheduled push,
// we schedule when the app opens — relying on the user to launch the app at least daily.
// (Best-effort. For guaranteed scheduled push you'd need a backend.)

import * as S from './state.js';
import { todayDay, advanceDay } from './engine.js';
import { dayKey } from './util.js';

export async function scheduleDailyNudges() {
  const s = S.get();
  if (!s.nudges) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.ready;
  if (!reg) return;

  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);

  // 1) Tomorrow-leg-day reminder: at 8 PM tonight if tomorrow is Legs
  const tomorrowDay = peekTomorrowDay();
  if (s.nudges.sleepEarlyBeforeLegs && tomorrowDay && /leg/i.test(tomorrowDay.name)) {
    const t = new Date(today); t.setHours(20, 0, 0, 0);
    await scheduleAt(t, 'Legs tomorrow', 'Heavy squats love good sleep. Aim for 8h tonight.', 'nudge-sleep-' + dayKey(t));
  }

  // 2) Fuel-before-legs: 60 min before workout start (we don't know exact time; default 5 PM)
  const todayName = todayDay()?.day?.name;
  if (s.nudges.fuelBeforeLegs && todayName && /leg/i.test(todayName)) {
    const t = new Date(today); t.setHours(16, 0, 0, 0);
    if (t > new Date()) {
      await scheduleAt(t, 'Legs in ~60 min', 'Eat a carb-rich snack now (banana + curd, or rice + dal).', 'nudge-fuel-' + dayKey(t));
    }
  }

  // 3) Caffeine timing
  if (s.nudges.caffeineMinBeforeWorkout > 0 && todayName && todayName !== 'Rest') {
    const t = new Date(today); t.setHours(17, 0, 0, 0); // assume ~5pm workout
    t.setMinutes(t.getMinutes() - s.nudges.caffeineMinBeforeWorkout);
    if (t > new Date()) {
      await scheduleAt(t, 'Caffeine window', `~${s.nudges.caffeineMinBeforeWorkout} min before training — small coffee if you want a boost.`, 'nudge-caf-' + dayKey(t));
    }
  }

  // 4) Adherence: if no log in 3+ days
  if (s.nudges.lowAdherenceCheckin) {
    const lastSet = s.sets[s.sets.length - 1];
    const days = lastSet ? (Date.now() - new Date(lastSet.createdAt).getTime()) / 86400000 : 999;
    if (days >= 3) {
      const t = new Date(today); t.setHours(18, 0, 0, 0);
      if (t > new Date()) {
        await scheduleAt(t, 'Still here?', "Haven't logged in a few days. Even a 20-min session counts.", 'nudge-adh-' + dayKey(t));
      }
    }
  }
}

async function scheduleAt(when, title, body, tag) {
  const delay = when.getTime() - Date.now();
  if (delay <= 0 || delay > 24 * 3600 * 1000) return;
  // Best-effort: a setTimeout while the app is open. Local notifications without backend push
  // can only fire when the timer is alive. We also fall back to a deferred Notification call
  // from the service worker via showNotification triggered from the page.
  setTimeout(async () => {
    try {
      const reg = await navigator.serviceWorker?.ready;
      reg?.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    } catch {}
  }, delay);
}

function peekTomorrowDay() {
  const s = S.get();
  const prog = s.programs[s.schedule.currentWeekType];
  const next = (s.schedule.nextDayIndex + 1) % (prog?.days?.length || 7);
  return prog?.days?.[next];
}
