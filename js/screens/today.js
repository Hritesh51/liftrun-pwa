import { el, fmtDate, fmtDistance, fmtDuration, fmtWeight, haptic, toast } from '../util.js';
import { confirmAction } from '../ui.js';
import * as S from '../state.js';
import * as Backup from '../backup.js';
import { todayDay, isDeloadWeek, advanceDay } from '../engine.js';
import { combinedStress, legImpactWarning } from '../stress.js';
import { smartDeloadSignal } from '../fatigue.js';
import { mesoState } from '../meso.js';
import { zeroEquipmentSession } from '../home.js';
import { readinessFromDaily, readinessAdvice } from '../readiness.js';
import { jointWarnings } from '../joint-load.js';
import { currentStreak, daysSinceLast, skipPattern } from '../streak.js';
import * as coach from '../coach.js';

export function render(view, router) {
  const s = S.get();
  if (!s.user.onboarded) return router.go('onboarding');

  const { weekType, day, dayIndex } = todayDay();
  const isRest = day.slots.length === 0;
  const deload = isDeloadWeek();
  const lastDone = s.sessions.find(x => x.status === 'done');
  const todaysReadiness = S.todaysReadiness();
  const lastRun = s.runs[0];

  const wrap = el('div', {}, [
    el('div', { class: 'h-row' }, [
      el('div', {}, [
        el('div', { class: 'eyebrow' }, [
          weekType === 'HOME' ? '🏠 Home training' : `Week ${weekType === 'A' ? 'A · PPL' : 'B · Bro Split'}`,
          deload ? '  · DELOAD' : '',
        ]),
        el('h1', {}, isRest ? 'Rest day' : day.name),
      ]),
      el('button', { class: 'btn icon', onclick: () => router.go('settings'), 'aria-label': 'Settings' }, [
        el('span', { html: `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M19.14 12.94a7.18 7.18 0 0 0 .05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a7.2 7.2 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.61.22L2.66 9.78a.5.5 0 0 0 .12.64L4.81 12c-.04.31-.05.62-.05.94s.01.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .61.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96a.5.5 0 0 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58Zm-7.14 2.56A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/></svg>` }),
      ]),
    ]),

    // Travel mode banner
    s.travelMode ? el('div', { class: 'card', style: { borderColor: 'var(--warn)' } }, [
      el('strong', { style: { color: 'var(--warn)' } }, '✈ Travel mode active'),
      el('p', { class: 'muted', style: { margin: '6px 0 0' } }, 'Bodyweight substitutions will appear in your workout. Turn off in Program.'),
    ]) : null,

    // Backup nudge — only when overdue (data lives only on-device; OS can evict it).
    Backup.needsBackup() ? el('div', { class: 'card', style: { borderColor: 'var(--warn)' } }, [
      el('strong', { style: { color: 'var(--warn)' } }, '⛑ Back up your data'),
      el('p', { class: 'muted', style: { margin: '6px 0 8px' } }, 'Your history lives only on this phone and can be cleared by the browser or iOS. Save a backup file to be safe.'),
      el('div', { class: 'row-flex', style: { gap: '8px' } }, [
        el('button', { class: 'btn sm primary', onclick: async () => { try { await Backup.downloadBackup(); toast('Backup saved', 'success'); router.refresh(); } catch { toast('Backup failed', 'error'); } } }, 'Back up now'),
        el('button', { class: 'btn sm ghost', onclick: () => router.go('settings') }, 'Settings'),
      ]),
    ]) : null,

    // Daily readiness composite
    renderReadinessCard(router),

    // Joint load warnings
    (() => {
      const warns = jointWarnings();
      if (!warns.length) return null;
      return el('div', { class: 'card', style: { borderColor: 'var(--warn)' } }, [
        el('strong', { style: { color: 'var(--warn)' } }, 'Joint load watch'),
        ...warns.slice(0, 2).map(w => el('p', { class: 'muted', style: { margin: '4px 0' } }, `${w.joint}: 7-day load +${w.deltaPct}% vs 28-day average — ease accessory work.`)),
      ]);
    })(),

    // Smart streak / re-engagement
    (() => {
      const streak = currentStreak();
      const since = daysSinceLast();
      const patterns = skipPattern();
      if (since != null && since >= 3) {
        return el('div', { class: 'card flat' }, [
          el('strong', {}, `Haven't logged in ${since} day${since > 1 ? 's' : ''}.`),
          patterns.length
            ? el('p', { class: 'muted', style: { margin: '4px 0 0' } }, `Tip: you tend to skip ${patterns[0].dayName} (${patterns[0].skipRate}% miss rate). Try moving that session to ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][(patterns[0].dow + 6) % 7]} instead.`)
            : el('p', { class: 'muted', style: { margin: '4px 0 0' } }, 'Even a 20-min session counts.'),
        ]);
      }
      if (streak >= 3) {
        return el('div', { class: 'card flat' }, [el('span', { class: 'pill good' }, `🔥 ${streak}-day streak`)]);
      }
      return null;
    })(),

    // Smart deload banner
    (() => {
      const sig = smartDeloadSignal();
      if (!sig.triggered) return null;
      return el('div', { class: 'card', style: { borderColor: 'var(--warn)' } }, [
        el('strong', { style: { color: 'var(--warn)' } }, '⚠ Deload signal'),
        el('p', { class: 'muted', style: { margin: '6px 0' } }, sig.reasons.join('; ') + '. Consider taking it easier this week.'),
      ]);
    })(),

    // Run→Leg conflict
    (() => { const w = legImpactWarning(); return w ? el('div', { class: 'card', style: { borderColor: 'var(--warn)' } }, [
      el('strong', { style: { color: 'var(--warn)' } }, 'Recovery check'),
      el('p', { class: 'muted', style: { margin: '6px 0 0' } }, w.message),
    ]) : null; })(),

    // Stress at a glance
    (() => {
      const stress = combinedStress();
      return el('div', { class: 'card flat' }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
          el('div', { class: 'eyebrow' }, ['Total stress (7d)']),
          el('span', { class: `pill ${stress.level === 'overreaching' ? 'warn' : stress.level === 'high' ? 'warn' : stress.level === 'low' ? '' : 'good'}` }, `${stress.score}/100 · ${stress.level}`),
        ]),
        el('div', { style: { height: '6px', background: 'var(--bg-3)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' } }, [
          el('div', { style: { width: `${stress.score}%`, height: '100%', background: stress.score > 85 ? 'var(--bad)' : stress.score > 65 ? 'var(--warn)' : 'var(--accent)' } }),
        ]),
      ]);
    })(),

    // Meso indicator
    (() => {
      const m = mesoState();
      return m.active ? el('div', { class: 'card flat' }, [
        el('div', { class: 'eyebrow' }, ['Mesocycle']),
        el('p', { style: { margin: '4px 0 0' } }, `Week ${m.currentWeek}/${m.lengthWeeks} · ${Math.round(m.multiplier * 100)}% volume${m.isDeloadWeek ? ' · DELOAD' : ''}`),
      ]) : null;
    })(),

    // Hero
    el('div', { class: 'hero' }, [
      el('div', { class: 'row-flex', style: { marginBottom: '8px' } }, [
        s.schedule.overrideForToday
          ? el('span', { class: 'pill warn' }, [`Override active`])
          : el('span', { class: 'pill' }, [`Day ${dayIndex + 1} / ${(s.programs[weekType] || {}).days?.length || 7}`]),
        deload ? el('span', { class: 'pill accent' }, ['Deload week']) : null,
      ]),
      isRest
        ? el('div', {}, [
            el('p', { class: 'muted', style: { margin: '0 0 12px' } }, 'Active recovery: light walk, easy 20–30 min Zone-2 run, or full rest. Your body grows on rest days.'),
            el('div', { class: 'row-flex', style: { gap: '8px' } }, [
              el('button', { class: 'btn', style: { flex: '1' }, onclick: () => router.go('run') }, 'Log an easy run'),
              el('button', { class: 'btn', style: { flex: '1' }, onclick: skipDay }, 'Skip today'),
            ]),
          ])
        : el('div', {}, [
            el('p', { class: 'muted', style: { margin: '0 0 12px' } }, `${day.slots.length} exercises${deload ? ' — reduce load ~15% and stop with 3 reps in reserve' : ''}.`),
            el('button', { class: 'btn primary lg block', onclick: () => startWorkout() }, 'Start workout'),
            el('div', { class: 'row-flex', style: { gap: '8px', marginTop: '8px' } }, [
              el('button', { class: 'btn', style: { flex: '1' }, onclick: () => openReadiness() }, todaysReadiness ? '✓ Check-in done' : 'Quick check-in'),
              el('button', { class: 'btn', style: { flex: '1' }, onclick: () => router.openSheet('skipDay', { day }) }, 'Options'),
            ]),
          ]),
    ]),

    // What's planned (peek)
    !isRest ? el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ["Today's lifts"]),
      el('div', { class: 'list' }, day.slots
        .map(slot => ({ slot, ex: S.getExercise(slot.exerciseId) }))
        .filter(x => x.ex)  // never render an unresolved/blank exercise
        .map(({ slot, ex }, i) => el('div', { class: 'list-item' }, [
          el('span', { class: 'faint', style: { minWidth: '20px' } }, String(i + 1)),
          el('div', {}, [
            el('div', { style: { fontWeight: 600 } }, ex.name),
            el('div', { class: 'faint' }, `${slot.sets} × ${slot.repLow}${slot.repLow !== slot.repHigh ? '–' + slot.repHigh : ''}`),
          ]),
          el('span', { class: 'meta' }, `${slot.restSec}s rest`),
        ]))),
    ]) : null,

    // Last session summary
    lastDone ? el('div', { class: 'card flat' }, [
      el('div', { class: 'eyebrow' }, ['Last session']),
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', {}, [el('strong', {}, lastDone.dayLabel), el('span', { class: 'faint' }, `  ${fmtDate(lastDone.date)}`)]),
        el('button', { class: 'btn sm ghost', onclick: () => router.go('progress') }, 'Progress →'),
      ]),
    ]) : null,

    // Running snapshot
    el('div', { class: 'card flat' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', { class: 'eyebrow' }, ['Running']),
        el('button', { class: 'btn sm', onclick: () => router.go('run') }, 'Open →'),
      ]),
      lastRun
        ? el('p', { class: 'muted', style: { margin: '6px 0 0' } }, `Last: ${fmtDate(lastRun.date)} · ${fmtDistance(lastRun.distanceMeters, s.settings.units)} · ${fmtDuration(lastRun.durationSeconds)}`)
        : el('p', { class: 'muted', style: { margin: '6px 0 0' } }, 'No runs yet. Easy Zone-2 keeps you fresh for Leg day.'),
    ]),

    // Home quick-actions (only in home mode)
    weekType === 'HOME' ? el('div', { class: 'card flat' }, [
      el('div', { class: 'eyebrow' }, ['Quick home options']),
      el('div', { class: 'row-flex', style: { marginTop: '8px' } }, [
        el('button', { class: 'btn sm', onclick: () => {
          haptic('medium');
          const sess = zeroEquipmentSession();
          const ses = S.startSession(sess.id, sess.name);
          // stash the synthetic day so workout can find it
          S.update(st => { const i = st.sessions.findIndex(x => x.id === ses.id); st.sessions[i]._zeroEquipDay = sess; });
          router.go('workout/' + ses.id);
        } }, '⚡ 15-min, no equipment'),
        el('button', { class: 'btn sm', onclick: () => router.openSheet('density') }, '⏱ Density timer'),
      ]),
    ]) : null,

    // Diet snapshot
    (() => {
      const menu = S.activeWeeklyMenu();
      const todayPlan = S.dailyDietPlanFor(new Date());
      return el('div', { class: 'card flat' }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
          el('div', { class: 'eyebrow' }, ['Diet']),
          el('button', { class: 'btn sm', onclick: () => router.go('diet') }, 'Open →'),
        ]),
        todayPlan
          ? el('p', { class: 'muted', style: { margin: '6px 0 0' } }, `Today: ~${todayPlan.totals?.proteinG || '?'}g protein · ~${todayPlan.totals?.kcal || '?'} kcal`)
          : (menu
            ? el('p', { class: 'muted', style: { margin: '6px 0 0' } }, 'Menu loaded — tap Open and generate today\'s plan.')
            : el('p', { class: 'muted', style: { margin: '6px 0 0' } }, 'Upload your weekly mess menu in the Diet tab to get daily eating plans.')),
      ]);
    })(),

    // Water intake
    renderWaterCard(router, s),

    // Coach note
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Coach']),
      el('div', { id: 'coachNote', class: 'muted' }, coach.isConfigured() ? 'Loading…' : 'AI offline — add an API key in Settings for tailored advice. The app still progresses you automatically.'),
    ]),
  ]);
  view.replaceChildren(wrap);
  loadCoachNote();

  async function loadCoachNote() {
    if (!coach.isConfigured()) return;
    const node = document.getElementById('coachNote');
    if (!node) return;
    // Cache per (day + isRest) for ~1 hour to avoid burning tokens on every render.
    const cacheKey = `liftrun.coachNote.${new Date().toISOString().slice(0, 13)}.${day.name}.${isRest ? 'rest' : 'work'}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { node.textContent = cached; return; }
    try {
      const m = isRest ? "I have a rest day. What's the one most useful thing to do today?" : `What's the focus for today's ${day.name}?`;
      const res = await coach.chat(m);
      if (res?.text && !res.offline) {
        sessionStorage.setItem(cacheKey, res.text);
      }
      const node2 = document.getElementById('coachNote');
      if (node2) node2.textContent = res.text;
    } catch (e) {}
  }

  function startWorkout() {
    haptic('medium');
    const ses = S.startSession(day.id, day.name);
    router.go(`workout/${ses.id}`);
  }
  async function skipDay() {
    if (!await confirmAction({ title: 'Skip today?', body: 'Moves on to the next planned session.', confirmLabel: 'Skip' })) return;
    haptic('light');
    advanceDay();
    router.refresh();
  }
  function openReadiness() {
    router.openSheet('readiness');
  }
}

function renderReadinessCard(router) {
  const log = S.todaysDailyLog();
  if (!log) {
    return el('div', { class: 'card flat' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', { class: 'eyebrow' }, ['Daily readiness']),
        el('button', { class: 'btn sm', onclick: () => router.openSheet('dailyLog') }, 'Log today'),
      ]),
      el('p', { class: 'muted', style: { margin: '6px 0 0', fontSize: '13px' } }, '30s: sleep, mood, energy, soreness, stress → today\'s readiness score + auto-adjusted load.'),
    ]);
  }
  const score = readinessFromDaily(log);
  const advice = readinessAdvice(score, log.pain);
  const color = advice.mode === 'pain' || advice.mode === 'low' ? 'var(--bad)' : advice.mode === 'moderate' ? 'var(--warn)' : advice.mode === 'primed' ? 'var(--accent)' : 'var(--good)';
  return el('div', { class: 'card flat' }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
      el('div', { class: 'eyebrow' }, ['Daily readiness']),
      el('button', { class: 'btn sm ghost', onclick: () => router.openSheet('dailyLog') }, 'Edit'),
    ]),
    el('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' } }, [
      el('span', { style: { fontSize: '28px', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' } }, String(score)),
      el('span', { class: 'muted', style: { fontSize: '13px' } }, `/100 · ${advice.mode}`),
    ]),
    el('p', { class: 'faint', style: { margin: '4px 0 0', fontSize: '13px' } }, advice.text),
    el('p', { class: 'faint', style: { margin: '4px 0 0', fontSize: '12px' } }, `Load factor today: ×${advice.factor.toFixed(2)}`),
  ]);
}

function renderWaterCard(router, s) {
  const ml = S.todaysWaterMl();
  const bw = s.body[0]?.weightKg || 63;
  const targetMl = Math.round(bw * 55); // ~55 ml/kg for active people
  const pct = Math.min(100, Math.round((ml / targetMl) * 100));
  return el('div', { class: 'card flat' }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
      el('div', { class: 'eyebrow' }, ['Water']),
      el('span', { class: 'faint', style: { fontSize: '12px' } }, `${ml} / ${targetMl} ml`),
    ]),
    el('div', { style: { height: '8px', background: 'var(--bg-3)', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' } }, [
      el('div', { style: { width: pct + '%', height: '100%', background: pct >= 100 ? 'var(--good)' : 'var(--accent)', transition: 'width .3s' } }),
    ]),
    el('div', { class: 'row-flex', style: { marginTop: '8px', justifyContent: 'space-between' } }, [
      el('button', { class: 'btn sm', onclick: () => { S.logWater(250); haptic('light'); router.refresh(); } }, '+250 ml'),
      el('button', { class: 'btn sm', onclick: () => { S.logWater(500); haptic('light'); router.refresh(); } }, '+500 ml'),
      el('button', { class: 'btn sm ghost', onclick: () => { S.logWater(1000); haptic('light'); router.refresh(); } }, '+1 L'),
    ]),
  ]);
}
