import { el, haptic, toast, fmtWeight, fmtDate, e1RM, roundTo, kgToLb, lbToKg } from '../util.js';
import * as S from '../state.js';
import { suggestNextSet, substitutionsFor, advanceDay } from '../engine.js';
import * as coach from '../coach.js';
import * as Timer from '../timer.js';
import { warmupSets, sessionPrimer } from '../warmup.js';
import { setCountScalar, mesoState } from '../meso.js';
import { autoRegSuggestion } from '../autoreg.js';
import { applyPeriodization } from '../periodization.js';
import { startTempo, stopTempo, isTempoRunning, parseTempo, speak } from '../setextras.js';
import { homeProgram, resolveHomeDay, homeSuggest, ladderUp, ladderDown, ladderInfo, availableLadder } from '../home.js';
import { confirmAction, exerciseDemo } from '../ui.js';
import { EXERCISE_INDEX } from '../seed.js';

export function render(view, router, params) {
  const sessionId = params?.sessionId;
  const sessions = S.get().sessions;
  const session = sessions.find(x => x.id === sessionId) || sessions.find(x => x.status === 'active');
  if (!session) {
    view.replaceChildren(el('div', { class: 'card' }, [
      el('p', {}, 'No active workout found.'),
      el('button', { class: 'btn primary block', onclick: () => router.go('today') }, 'Back to Today'),
    ]));
    return;
  }
  const s = S.get();
  const isHome = session.weekType === 'HOME';
  let day;
  if (session._zeroEquipDay) {
    day = session._zeroEquipDay; // synthetic quick bodyweight session
  } else if (isHome) {
    const prog = homeProgram();
    const rawDay = prog.days.find(d => d.id === session.dayId) || prog.days[s.homeSchedule?.nextDayIndex || 0];
    day = resolveHomeDay(rawDay);
  } else {
    const program = s.programs[session.weekType] || s.programs.A;
    day = program.days.find(d => d.id === session.dayId);
    if (!day) day = program.days[s.schedule.nextDayIndex];
  }

  const wrap = el('div', {}, [
    el('div', { class: 'h-row' }, [
      el('button', { class: 'btn icon', onclick: () => router.go('today'), 'aria-label': 'Back' }, [
        el('span', { html: `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>` }),
      ]),
      el('h1', { class: 'workout-title' }, day.name),
      el('button', { class: 'btn icon', onclick: () => router.openSheet('plateCalc'), 'aria-label': 'Plate calculator', title: 'Plate calculator' }, [
        el('span', { html: `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M4 8h2v8H4zm14 0h2v8h-2zM7 4h2v16H7zm8 0h2v16h-2zm-4 7h2v2h-2z"/></svg>` }),
      ]),
      el('button', { class: 'btn icon', onclick: () => router.openSheet('pain'), 'aria-label': 'Log a twinge', title: 'Log a twinge' }, [
        el('span', { html: `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2 4 14h6l-1 8 9-12h-6z"/></svg>` }),
      ]),
      el('button', { class: 'btn icon', onclick: () => router.openSheet('quickLog', { session }), 'aria-label': 'Quick log', title: 'Quick log' }, [
        el('span', { html: `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm1 11h-2V9h2zm0 4h-2v-2h2z"/></svg>` }),
      ]),
      el('button', { class: 'btn sm', onclick: () => endSession() }, 'Finish'),
    ]),
    // Session primer (collapsible)
    renderPrimer(day.name),
    el('div', { id: 'exList' }, day.slots.filter(slot => S.getExercise(slot.exerciseId)).map((slot, idx) => renderExerciseBlock(slot, idx, session, router))),
    el('div', { class: 'card flat' }, [
      el('div', { class: 'eyebrow' }, ['Session notes']),
      el('textarea', { id: 'sessionNotes', rows: 2, placeholder: 'How did it go? Any twinges?', oninput: (e) => S.update(s => {
        const i = s.sessions.findIndex(x => x.id === session.id);
        if (i >= 0) s.sessions[i].notes = e.target.value;
      }) }, session.notes || ''),
    ]),
    el('div', { class: 'row-flex', style: { justifyContent: 'space-between' } }, [
      el('button', { class: 'btn ghost danger', onclick: () => abandonSession() }, 'Cancel session'),
      el('button', { class: 'btn', onclick: () => router.openSheet('voiceDebrief', { sessionId: session.id }) }, '🎤 Debrief'),
      el('button', { class: 'btn primary lg', onclick: () => endSession() }, 'Finish workout'),
    ]),
    el('div', { class: 'spacer' }),
    el('div', { class: 'spacer' }),
  ]);
  view.replaceChildren(wrap);

  function endSession() {
    haptic('success');
    S.endSession(session.id);
    advanceDay();
    Timer.stop();
    toast('Logged. Recovery starts now.', 'success');
    router.go('today');
  }
  async function abandonSession() {
    if (!await confirmAction({ title: 'Cancel this session?', body: 'Your logged sets are kept; the session is marked skipped.', confirmLabel: 'Cancel session' })) return;
    S.endSession(session.id, { skipped: true });
    Timer.stop();
    router.go('today');
  }
}

// ---------------- Exercise block ----------------

function renderLadderViz(pattern, router) {
  const info = ladderInfo(pattern);
  if (!info) return null;
  return el('div', { style: { marginBottom: '8px' } }, [
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '4px' } },
      info.ladder.map((ex, i) => el('div', {
        title: ex.name,
        style: {
          flex: 1, height: '5px', borderRadius: '3px',
          background: i < info.index ? 'var(--accent)' : i === info.index ? 'var(--accent-2)' : 'var(--bg-3)',
        },
      }))),
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
      el('span', { class: 'faint', style: { fontSize: '11px' } }, `Ladder: level ${info.index + 1} of ${info.total}`),
      info.prev ? el('button', { class: 'btn sm ghost', style: { fontSize: '11px', padding: '2px 8px' }, onclick: () => {
        const p = ladderDown(pattern);
        if (p) { haptic('select'); toast(`Dropped to ${p.name}`); router.refresh(); }
      } }, '↓ Too hard? Drop a level') : null,
    ]),
  ]);
}

function renderWarmupBlock(workingKg, units) {
  const sets = warmupSets(workingKg);
  if (!sets.length) return null;
  return el('details', { style: { margin: '6px 0 10px', padding: '6px 10px', background: 'var(--bg-3)', borderRadius: '8px' } }, [
    el('summary', { style: { cursor: 'pointer', listStyle: 'none', fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600 } },
      `Warm-ups · ${sets.length} sets ramped to ${fmtWeight(workingKg, units)}`),
    el('div', { style: { marginTop: '6px' } }, sets.map((w, i) => el('div', { style: { fontSize: '12px', color: 'var(--text-dim)', padding: '2px 0' } },
      `${i + 1}. ${fmtWeight(w.weightKg, units)} × ${w.reps}  · ${w.note}`))),
  ]);
}

function renderPrimer(dayName) {
  const lines = sessionPrimer(dayName);
  const wrap = el('details', { class: 'card flat', style: { marginBottom: '12px' } }, [
    el('summary', { style: { cursor: 'pointer', listStyle: 'none', fontWeight: 600 } }, [
      el('span', { class: 'eyebrow' }, [`Warm-up primer · ${dayName}`]),
    ]),
    el('ul', { style: { margin: '8px 0 0', paddingLeft: '20px', lineHeight: 1.6 } }, lines.map(l => el('li', {}, l))),
  ]);
  return wrap;
}

function renderExerciseBlock(slot, slotIdx, session, router) {
  const ex = S.getExercise(slot.exerciseId);
  if (!ex) return el('div', { class: 'card' }, `Unknown exercise: ${slot.exerciseId}`);
  const block = el('div', { class: 'exercise-block', dataset: { exerciseId: ex.id, slotIdx: String(slotIdx) } });
  redraw();
  return block;

  function redraw() {
    const allSets = S.setsForSession(session.id).filter(s => s.exerciseId === ex.id);
    const last = S.lastSessionWith(ex.id, session.id);
    const units = S.get().settings.units;
    const isHomeSlot = !!slot.pattern && availableLadder(slot.pattern).length > 0;

    /** @type {any} */ let sug; let scaledSlot, setsChanged = false, meso = { active: false };
    let ladderUpInfo = null;
    if (isHomeSlot) {
      // Home: ladder-based progression (reps + difficulty), no weight.
      sug = homeSuggest(ex, slot, last?.sets);
      sug.weightKg = null;
      scaledSlot = { ...slot };
      if (sug.ladderUp) ladderUpInfo = { newId: sug.ladderUp, name: sug.ladderUpName };
    } else {
      // Gym: periodization + auto-regulation.
      const dayOfWeek = new Date().getDay();
      meso = mesoState();
      const periodSlot = applyPeriodization(slot, dayOfWeek, meso.currentWeek || 1);
      sug = autoRegSuggestion(ex.id, periodSlot);
      const scalar = (meso.active && Number.isFinite(meso.multiplier)) ? meso.multiplier : 1.0;
      const baseSetCount = Number.isFinite(slot.sets) && slot.sets > 0 ? slot.sets : 3;
      const effectiveSets = Math.max(1, Math.round(baseSetCount * scalar));
      scaledSlot = { ...slot, sets: effectiveSets };
      setsChanged = meso.active && Number.isFinite(meso.currentWeek) && Number.isFinite(meso.lengthWeeks) && effectiveSets !== baseSetCount;
      var baseSetCountOuter = baseSetCount; // for meso note below
    }
    const baseSetCount = isHomeSlot ? slot.sets : (typeof baseSetCountOuter !== 'undefined' ? baseSetCountOuter : slot.sets);
    const effectiveSets = scaledSlot.sets;

    // Build children, filter out null/false/undefined (Element.replaceChildren would coerce them to the literal string "null"/"undefined").
    const children = [
      el('div', { class: 'ex-header' }, [
        el('h3', {}, ex.name),
        el('button', { class: 'btn sm ghost', onclick: () => router.go(`exercise/${ex.id}`), 'aria-label': 'Details' }, 'Info'),
        el('button', { class: 'btn sm ghost', onclick: () => openSwap(), 'aria-label': 'Swap exercise' }, 'Swap'),
        el('button', { class: 'btn sm ghost', onclick: () => toggleTempo(), 'aria-label': 'Tempo metronome' }, isTempoRunning() ? '⏹' : '⏱'),
      ]),
      // Looping movement demo (free-exercise-db frames), like a short video.
      ex.imageUrl ? el('div', { style: { marginBottom: '8px' } }, [exerciseDemo(ex, { maxHeight: '150px', compact: true })]) : null,
      el('div', { class: 'faint', style: { marginBottom: '6px' } }, [
        last
          ? `Last: ${formatLast(last, units)}`
          : 'No history — start light, RPE 6–7.',
      ]),
      sug ? el('div', { class: 'pill accent', style: { marginBottom: '8px' } }, [
        sug.weightKg != null ? `Suggested: ${fmtWeight(sug.weightKg, units)} × ${sug.reps}` : (isHomeSlot ? `Target: ${slot.repLow}–${slot.repHigh} reps` : `Suggested: build up; ${slot.repLow}–${slot.repHigh} reps`),
        sug.note ? el('span', { class: 'faint', style: { marginLeft: '8px', fontWeight: 400 } }, sug.note) : null,
      ]) : null,
      ladderUpInfo ? el('button', { class: 'btn sm primary', style: { marginBottom: '8px' }, onclick: () => {
        ladderUp(slot.pattern, ladderUpInfo.newId);
        haptic('pr');
        toast(`Leveled up to ${ladderUpInfo.name}! 🎯`, 'success');
        router.refresh();
      } }, `⬆ Level up to ${ladderUpInfo.name}`) : null,
      isHomeSlot ? renderLadderViz(slot.pattern, router) : null,
      setsChanged ? el('div', { class: 'faint', style: { marginBottom: '8px', fontSize: '12px' } },
        `Meso week ${meso.currentWeek}/${meso.lengthWeeks}: ${effectiveSets} sets (planned ${baseSetCount})${meso.isDeloadWeek ? ' · DELOAD' : ''}`) : null,
      sug?.weightKg ? renderWarmupBlock(sug.weightKg, units) : null,
      el('div', { class: 'set-row head' }, [
        el('span', {}, '#'),
        el('span', {}, `Weight (${units})`),
        el('span', {}, 'Reps'),
        el('span', {}, 'RPE'),
        el('span', {}),
      ]),
      ...Array.from({ length: Math.max(effectiveSets, allSets.length + 1) }).map((_, i) => renderSetRow(i, allSets, sug, scaledSlot, ex, session, units, redraw)),
      el('div', { class: 'row-flex', style: { marginTop: '8px', justifyContent: 'flex-end' } }, [
        el('button', { class: 'btn sm ghost', onclick: () => addExtraSet() }, '+ Add set'),
      ]),
    ].filter(Boolean);
    block.replaceChildren(...(/** @type {any[]} */ (children)));

    function toggleTempo() {
      if (isTempoRunning()) { stopTempo(); haptic('light'); redraw(); return; }
      const reps = sug?.reps || slot.repHigh || 10;
      const tempo = parseTempo(slot.tempo) || { eccentric: 3, pauseBottom: 0, concentric: 1, pauseTop: 0 };
      haptic('medium');
      if (S.get().nudges?.audioCoachingMidSet) speak(`${ex.name}. ${reps} reps. Slow eccentric.`);
      startTempo(tempo, reps, () => {});
      redraw();
    }

    function addExtraSet() {
      // Force a re-render with one more row (the algorithm above already shows one trailing input row).
      // To get an extra blank past that, we log an empty placeholder isn't ideal; instead bump min count.
      slot._extra = (slot._extra || 0) + 1;
      redraw();
    }
    function openSwap() {
      router.openSheet('swap', { exerciseId: ex.id, slot, session, slotIdx, onSwap: (newId) => {
        // Mutate the program's slot for this session's day only? Simpler: mutate program permanently.
        S.update(s => {
          const prog = s.programs[session.weekType];
          const d = prog.days.find(dd => dd.id === session.dayId);
          if (d) d.slots[slotIdx] = { ...slot, exerciseId: newId };
        });
        router.refresh();
      }});
    }
  }
}

function renderSetRow(idx, doneSets, sug, slot, ex, session, units, onChange) {
  const done = doneSets[idx];
  const prevDone = doneSets[idx - 1];
  const isPending = !done;
  // Auto-fill values from previous set (or suggestion).
  const defaultWeightKg = done?.weightKg ?? prevDone?.weightKg ?? sug?.weightKg ?? null;
  const defaultReps     = done?.reps     ?? prevDone?.reps     ?? sug?.reps     ?? slot.repLow;
  const defaultRpe      = done?.rpe      ?? null;
  const defaultType     = done?.type     ?? 'working';

  // Defensive: never let NaN or non-finite numbers render as input value (would show literal "NaN" or "null").
  const safeWeightKg = Number.isFinite(defaultWeightKg) ? defaultWeightKg : null;
  const safeReps = Number.isFinite(defaultReps) ? defaultReps : (Number.isFinite(slot?.repLow) ? slot.repLow : 8);
  const displayWeight = safeWeightKg == null ? '' : (units === 'lb' ? Math.round(kgToLb(safeWeightKg) * 2) / 2 : Math.round(safeWeightKg * 2) / 2);

  // TUT (time-under-tension) — start when the user first interacts with this row, stop when they Log.
  let setStartTs = null;
  const startTUT = () => { if (!setStartTs) setStartTs = Date.now(); };

  const wInput = /** @type {HTMLInputElement} */ (el('input', { type: 'number', step: '0.5', value: String(displayWeight), inputmode: 'decimal', 'aria-label': 'Weight', onfocus: startTUT, oninput: startTUT }));
  const rInput = /** @type {HTMLInputElement} */ (el('input', { type: 'number', step: '1', value: String(safeReps), inputmode: 'numeric', 'aria-label': 'Reps', onfocus: startTUT, oninput: startTUT }));
  const rpeBtn = el('button', { class: 'rpe-chip', onclick: () => cycleRpe() }, defaultRpe ? String(defaultRpe) : 'RPE');
  const logBtn = el('button', { class: 'log-btn', onclick: () => commit() }, done ? '✓' : 'Log');
  let currentRpe = defaultRpe;
  function cycleRpe() {
    const order = [null, 6, 7, 8, 9, 10];
    const i = order.indexOf(currentRpe);
    currentRpe = order[(i + 1) % order.length];
    rpeBtn.textContent = currentRpe ? String(currentRpe) : 'RPE';
    haptic('light');
    if (done) S.updateSet(done.id, { rpe: currentRpe });
  }

  const row = el('div', { class: 'set-row' + (done ? ' done' : '') }, [
    el('span', { class: 'idx' }, String(idx + 1)),
    el('div', { class: 'stepper' }, [
      el('button', { type: 'button', onclick: () => bumpW(-0.5), 'aria-label': '-' }, '–'),
      wInput,
      el('button', { type: 'button', onclick: () => bumpW(0.5), 'aria-label': '+' }, '+'),
    ]),
    el('div', { class: 'stepper' }, [
      el('button', { type: 'button', onclick: () => bumpR(-1), 'aria-label': '-' }, '–'),
      rInput,
      el('button', { type: 'button', onclick: () => bumpR(1), 'aria-label': '+' }, '+'),
    ]),
    rpeBtn,
    logBtn,
  ]);
  // Long-press the index for set-type menu
  let lpTimer;
  row.querySelector('.idx')?.addEventListener('pointerdown', () => {
    lpTimer = setTimeout(() => openTypeMenu(), 500);
  });
  row.querySelector('.idx')?.addEventListener('pointerup', () => clearTimeout(lpTimer));

  function bumpW(d) { wInput.value = String(Math.max(0, Math.round((parseFloat(wInput.value || '0') + d) * 2) / 2)); haptic('light'); }
  function bumpR(d) { rInput.value = String(Math.max(0, (parseInt(rInput.value || '0', 10) + d))); haptic('light'); }
  function commit() {
    const wVal = parseFloat(wInput.value);
    const rVal = parseInt(rInput.value, 10);
    if (isNaN(rVal) || rVal <= 0) { toast('Add reps first', 'error'); return; }
    const isBodyweight = ex.loadType === 'bodyweight+' || ex.loadType === 'bodyweight' || ex.loadType === 'time' || ex.loadType === 'reps';
    // Validate weight for load-required exercises — no silent 0kg sets.
    if (!isBodyweight && (isNaN(wVal) || wVal <= 0)) {
      toast(`Add a weight for ${ex.name}`, 'error');
      return;
    }
    const kg = isBodyweight && (isNaN(wVal) || wVal === 0) ? 0
             : units === 'lb' ? lbToKg(wVal || 0)
             : (wVal || 0);
    if (done) {
      S.updateSet(done.id, { weightKg: kg, reps: rVal, rpe: currentRpe });
      haptic('light');
      onChange();
      return;
    }
    // Track rotation usage at the moment a real set is logged (not at render time).
    S.markExerciseUsed(ex.id);
    const tutSec = setStartTs ? Math.round((Date.now() - setStartTs) / 1000) : null;
    S.logSet({
      sessionId: session.id,
      exerciseId: ex.id,
      type: defaultType,
      weightKg: kg,
      reps: rVal,
      rpe: currentRpe,
      tutSec, // time-under-tension proxy
    });
    // PR check — works for loaded lifts (weight/e1RM) AND bodyweight movements (rep PRs).
    const oldPRs = S.get().prs[ex.id];
    let wasPR;
    if (kg > 0) {
      const e1 = e1RM(kg, rVal);
      wasPR =
        !oldPRs ||
        e1 > (oldPRs.bestE1RM || 0) ||
        kg > (oldPRs.bestWeightKg || 0) ||
        (kg === (oldPRs.bestWeightKg || 0) && rVal > (oldPRs.bestReps || 0));
      S.updatePRs(ex.id, { e1, weightKg: kg, reps: rVal, volume: kg * rVal });
    } else {
      // Bodyweight: a rep PR is most reps in a single working set.
      wasPR = (defaultType === 'working') && (!oldPRs || rVal > (oldPRs.bestReps || 0));
      S.updatePRs(ex.id, { e1: 0, weightKg: 0, reps: rVal, volume: rVal });
    }
    if (wasPR) {
      celebratePR(ex.name + (kg === 0 ? ` — ${rVal} reps!` : ''));
      haptic('pr');
    } else {
      haptic('success');
    }
    Timer.start(slot.restSec || 90);
    onChange();
  }
  function openTypeMenu() {
    if (!done) return;
    const types = ['working', 'warmup', 'drop', 'failure'];
    const i = types.indexOf(done.type || 'working');
    const next = types[(i + 1) % types.length];
    S.updateSet(done.id, { type: next });
    toast(`Set type: ${next}`);
    onChange();
  }
  return row;
}

function formatLast(last, units) {
  const sets = last.sets.filter(s => s.type === 'working');
  if (!sets.length) return '—';
  const w = Math.max(...sets.map(s => s.weightKg || 0));
  const reps = sets.map(s => s.reps).join(',');
  return `${sets.length}×[${reps}] @ ${fmtWeight(w, units)}`;
}

function celebratePR(name) {
  const node = document.createElement('div');
  node.className = 'pr-celebration';
  node.textContent = `🏆 PR — ${name}!`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1600);
}
