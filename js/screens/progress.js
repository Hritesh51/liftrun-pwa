import { el, fmtWeight, fmtDate } from '../util.js';
import * as S from '../state.js';
import { weeklyReview, adherenceLast } from '../engine.js';
import { volumeStatus, underVolumedMuscles, overVolumedMuscles } from '../volume.js';
import { combinedStress, legImpactWarning } from '../stress.js';
import { smartDeloadSignal } from '../fatigue.js';
import { mesoState } from '../meso.js';
import { lineChart, barChart, calendarHeatmap } from '../charts.js';
import { EXERCISE_INDEX } from '../seed.js';
import { BADGES, unlockedBadges } from '../achievements.js';

export function render(view, router) {
  const s = S.get();
  const review = weeklyReview();
  const adher = adherenceLast(28);
  const prs = Object.entries(s.prs || {}).sort((a, b) => (b[1].lastUpdated || '').localeCompare(a[1].lastUpdated || ''));
  const bw = s.body.slice().reverse().map(b => ({ x: new Date(b.date).getTime(), y: b.weightKg }));
  const vstatus = volumeStatus(7);
  const stress = combinedStress();
  const meso = mesoState();
  const deloadSignal = smartDeloadSignal();
  const legWarn = legImpactWarning();

  view.replaceChildren(el('div', {}, [
    el('div', { class: 'h-row' }, [el('h1', {}, 'Progress')]),

    // ---- Smart deload banner ----
    deloadSignal.triggered ? el('div', { class: 'card', style: { borderColor: 'var(--warn)' } }, [
      el('strong', { style: { color: 'var(--warn)' } }, '⚠ Consider a deload week'),
      el('p', { class: 'muted', style: { margin: '6px 0' } }, deloadSignal.reasons.join('; ') + '.'),
      el('button', { class: 'btn sm', onclick: () => { S.startMeso(1); router.refresh(); } }, 'Start deload now'),
    ]) : null,

    legWarn ? el('div', { class: 'card', style: { borderColor: 'var(--warn)' } }, [
      el('strong', { style: { color: 'var(--warn)' } }, 'Run → Leg conflict'),
      el('p', { class: 'muted', style: { margin: '6px 0 0' } }, legWarn.message),
    ]) : null,

    // ---- This week stats ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Last 7 days']),
      el('div', { class: 'grid-2', style: { marginTop: '8px' } }, [
        statBlock('Sessions', String(review.sessions)),
        statBlock('Working sets', String(review.sets)),
        statBlock('Runs', String(review.runs)),
        statBlock('Run distance', `${(review.totalDistanceMeters / 1000).toFixed(1)} km`),
      ]),
    ]),

    // ---- Stress meter ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Total stress (last 7d)']),
      el('div', { style: { marginTop: '8px' } }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' } }, [
          el('span', { style: { fontWeight: 600 } }, `${stress.score}/100`),
          el('span', { class: `pill ${stress.level === 'overreaching' ? 'warn' : stress.level === 'high' ? 'warn' : stress.level === 'low' ? '' : 'good'}` }, stress.level),
        ]),
        el('div', { style: { height: '8px', background: 'var(--bg-3)', borderRadius: '4px', overflow: 'hidden' } }, [
          el('div', { style: { width: `${stress.score}%`, height: '100%', background: stress.score > 85 ? 'var(--bad)' : stress.score > 65 ? 'var(--warn)' : 'var(--accent)', transition: 'width .3s' } }),
        ]),
        el('p', { class: 'faint', style: { marginTop: '6px' } }, `Lifting: ${stress.lift} · Running: ${stress.run}`),
      ]),
    ]),

    // ---- Mesocycle marker ----
    meso.active ? el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Mesocycle']),
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('strong', {}, `Week ${meso.currentWeek} / ${meso.lengthWeeks}${meso.isDeloadWeek ? ' · DELOAD' : ''}`),
        el('span', { class: 'pill accent' }, `${Math.round(meso.multiplier * 100)}% volume`),
      ]),
      el('div', { style: { height: '6px', background: 'var(--bg-3)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' } }, [
        el('div', { style: { width: `${(meso.currentWeek / meso.lengthWeeks) * 100}%`, height: '100%', background: 'var(--accent)' } }),
      ]),
    ]) : null,

    // ---- Volume per muscle vs landmarks ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Weekly volume per muscle (vs landmarks)']),
      el('p', { class: 'faint', style: { margin: '4px 0 10px' } }, 'Bars: actual sets. Marks: MEV (▲), MAV (●), MRV (■).'),
      el('div', { style: { display: 'grid', gridTemplateColumns: '1fr', gap: '6px' } }, Object.entries(vstatus)
        .filter(([_, v]) => v.landmark.mrv > 0)
        .sort((a, b) => b[1].sets - a[1].sets)
        .map(([m, v]) => volumeRow(m, v))),
    ]),

    // ---- Volume suggestions ----
    (() => {
      const under = underVolumedMuscles(7).slice(0, 3);
      const over  = overVolumedMuscles(7).slice(0, 2);
      if (!under.length && !over.length) return null;
      return el('div', { class: 'card' }, [
        el('div', { class: 'eyebrow' }, ['Volume suggestions']),
        ...under.map(u => el('p', { class: 'muted', style: { margin: '6px 0' } }, `↑ ${u.muscle}: ${u.sets.toFixed(1)}/${u.mev} — add ${Math.ceil(u.gap)} sets to hit MEV.`)),
        ...over.map(o => el('p', { style: { margin: '6px 0', color: 'var(--warn)' } }, `↓ ${o.muscle}: ${o.sets.toFixed(1)}/${o.mrv} — recovery debt building.`)),
      ]);
    })(),

    // ---- Total tonnage (different metric: weight × reps, not fractional sets) ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Tonnage by muscle (weight × reps)']),
      el('p', { class: 'faint', style: { margin: '4px 0 8px' } }, 'Different metric than the set-band view above — total weight moved per muscle.'),
      barChart(Object.entries(review.volByMuscle).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([m, v]) => ({ label: m, value: v }))),
    ]),

    // ---- Adherence calendar ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Adherence — last 4 weeks']),
      calendarHeatmap(adher),
      el('div', { class: 'row-flex', style: { marginTop: '10px', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-faint)' } }, [
        legend('var(--accent)', 'Workout'),
        legend('rgba(255,100,56,.4)', 'Run only'),
        legend('var(--line)', 'Rest/skipped'),
      ]),
    ]),

    // ---- Bodyweight ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Bodyweight']),
      bw.length ? lineChart(bw, { units: s.settings.units }) : el('p', { class: 'muted' }, 'Log your weight on the Body screen.'),
    ]),

    // ---- Goal trajectory ----
    s.goals?.targetWeightKg ? renderGoalProjection(s, bw) : null,

    // ---- Achievements ----
    (() => {
      const unlocked = new Set(unlockedBadges());
      return el('div', { class: 'card' }, [
        el('div', { class: 'eyebrow' }, [`Achievements (${unlocked.size}/${BADGES.length})`]),
        el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' } },
          BADGES.map(b => el('div', {
            style: {
              padding: '10px 6px', borderRadius: '10px',
              background: unlocked.has(b.id) ? 'var(--bg-3)' : 'transparent',
              border: `1px solid ${unlocked.has(b.id) ? 'var(--accent)' : 'var(--line)'}`,
              textAlign: 'center', opacity: unlocked.has(b.id) ? '1' : '.4',
            },
            title: `${b.name} — ${b.desc}`,
          }, [
            el('div', { style: { fontSize: '22px' } }, b.emoji),
            el('div', { style: { fontSize: '10px', fontWeight: 600, marginTop: '4px' } }, b.name),
          ]))),
      ]);
    })(),

    // ---- PRs ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['PRs']),
      prs.length ? el('div', { class: 'list' }, prs.slice(0, 15).map(([id, pr]) => {
        const ex = EXERCISE_INDEX[id];
        return el('div', { class: 'list-item' }, [
          el('div', {}, [
            el('div', { style: { fontWeight: 600 } }, ex?.name || id),
            el('div', { class: 'faint' }, pr.bodyweight || (pr.bestWeightKg || 0) === 0
              ? `Best: ${pr.bestReps} reps (bodyweight)`
              : `Best: ${fmtWeight(pr.bestWeightKg, s.settings.units)} × ${pr.bestReps} · e1RM ${fmtWeight(pr.bestE1RM, s.settings.units)}`),
          ]),
          el('span', { class: 'meta' }, fmtDate(pr.lastUpdated)),
        ]);
      })) : el('p', { class: 'muted' }, 'PRs appear here as you log heavier or higher-rep sets.'),
    ]),
  ]));
}

// Render one row: muscle name, bar, MEV/MAV/MRV marks.
function volumeRow(muscle, v) {
  const max = Math.max(v.landmark.mrv * 1.1, v.sets);
  const pct = (n) => `${Math.min(100, (n / max) * 100)}%`;
  const color = v.band === 'over' ? 'var(--bad)' : v.band === 'mrv-zone' ? 'var(--warn)' : v.band === 'mav' ? 'var(--good)' : v.band === 'mev' ? 'var(--accent)' : 'var(--text-faint)';
  return el('div', { style: { display: 'grid', gridTemplateColumns: '80px 1fr 60px', alignItems: 'center', gap: '8px' } }, [
    el('span', { style: { fontSize: '12px', color: 'var(--text-dim)' } }, muscle),
    el('div', { style: { position: 'relative', height: '14px', background: 'var(--bg-3)', borderRadius: '3px', overflow: 'hidden' } }, [
      el('div', { style: { position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(v.sets), background: color, transition: 'width .3s' } }),
      el('div', { style: { position: 'absolute', left: pct(v.landmark.mev), top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,.5)' }, title: 'MEV' }),
      el('div', { style: { position: 'absolute', left: pct(v.landmark.mav), top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,.8)' }, title: 'MAV' }),
      el('div', { style: { position: 'absolute', left: pct(v.landmark.mrv), top: 0, bottom: 0, width: '1px', background: 'var(--bad)' }, title: 'MRV' }),
    ]),
    el('span', { style: { fontSize: '12px', fontVariantNumeric: 'tabular-nums', textAlign: 'right' } }, `${v.sets} / ${v.landmark.mav}`),
  ]);
}

function renderGoalProjection(s, bwSeries) {
  const target = s.goals.targetWeightKg;
  const date = s.goals.targetDate ? new Date(s.goals.targetDate) : null;
  const current = bwSeries[bwSeries.length - 1]?.y || s.user.startingWeightKg;
  const remaining = target - current;
  const daysLeft = date ? Math.max(0, Math.round((new Date(date).getTime() - Date.now()) / 86400000)) : null;
  const rate = daysLeft ? (remaining / daysLeft) * 7 : null; // kg/week needed
  return el('div', { class: 'card' }, [
    el('div', { class: 'eyebrow' }, ['Long-term goal']),
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' } }, [
      el('div', {}, [el('strong', {}, `${current.toFixed(1)} → ${target} kg`)]),
      date ? el('span', { class: 'faint' }, `by ${fmtDate(date)}`) : null,
    ]),
    rate !== null ? el('p', { class: 'faint' }, `Need ~${rate >= 0 ? '+' : ''}${rate.toFixed(2)} kg/week. ${Math.abs(rate) > 0.5 ? 'Aggressive — consider a longer timeline.' : 'Sustainable pace.'}`) : null,
  ]);
}

function statBlock(label, value) {
  return el('div', { class: 'card flat', style: { padding: '12px' } }, [
    el('div', { class: 'eyebrow' }, [label]),
    el('div', { style: { fontSize: '22px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: '4px' } }, value),
  ]);
}
function legend(color, label) {
  return el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, [
    el('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: color, display: 'inline-block' } }),
    label,
  ]);
}
