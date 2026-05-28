// Sheets + sub-screens for the elite-tier features:
// daily log, movement screen, mobility routine, voice debrief, bloodwork
import { el, toast, haptic, fmtDate } from '../util.js';
import * as S from '../state.js';
import { readinessFromDaily, readinessAdvice } from '../readiness.js';
import { drillsForWeakLinks, weakLinksFrom } from '../mobility.js';
import { callProvider } from '../coach.js';

// ============== Daily log ==============

export function renderDailyLogSheet(sheetBody, ctx, router) {
  const existing = S.todaysDailyLog();
  const draft = {
    sleepHours: existing?.sleepHours ?? 7,
    sleepQuality: existing?.sleepQuality ?? 3,
    mood: existing?.mood ?? 3,
    energy: existing?.energy ?? 3,
    soreness: existing?.soreness ?? 3,
    stress: existing?.stress ?? 3,
    hrvMs: existing?.hrvMs ?? null,
    restingHR: existing?.restingHR ?? null,
    pain: existing?.pain ?? false,
    note: existing?.note ?? '',
  };
  redraw();

  function redraw() {
    const previewScore = readinessFromDaily(draft);
    const advice = readinessAdvice(previewScore, draft.pain);
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Daily log'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, '~30 seconds. Drives today\'s readiness score and auto-adjusts load.'),

      el('div', { class: 'card flat', style: { padding: '10px' } }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
          el('div', { class: 'eyebrow' }, ['Readiness preview']),
          el('span', { class: `pill ${advice.mode === 'low' || advice.mode === 'pain' ? 'warn' : advice.mode === 'primed' ? 'accent' : advice.mode === 'good' ? 'good' : ''}` }, `${previewScore}/100 · ${advice.mode}`),
        ]),
        el('p', { class: 'faint', style: { margin: '4px 0 0' } }, advice.text),
      ]),

      numericField('Sleep last night (hours)', 'sleepHours', 0, 12, 0.5, draft, redraw),
      sliderField('Sleep quality', 'sleepQuality', draft, redraw, ['Bad','Poor','OK','Good','Great']),
      sliderField('Energy', 'energy', draft, redraw, ['Drained','Tired','OK','Good','Sharp']),
      sliderField('Mood', 'mood', draft, redraw, ['Low','Off','OK','Good','Great']),
      sliderField('Soreness', 'soreness', draft, redraw, ['None','Mild','Moderate','High','Severe']),
      sliderField('Life stress', 'stress', draft, redraw, ['Calm','Low','OK','High','Very high']),

      el('details', { class: 'card flat' }, [
        el('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, 'Advanced (HRV / Resting HR — from your watch)'),
        numericField('HRV (ms)', 'hrvMs', 0, 200, 1, draft, redraw, true),
        numericField('Resting HR (bpm)', 'restingHR', 30, 100, 1, draft, redraw, true),
      ]),

      el('div', { class: 'toggle' }, [
        el('div', { class: 'label' }, 'Any sharp pain right now?'),
        el('button', { class: 'switch', 'aria-checked': String(draft.pain), onclick: () => { draft.pain = !draft.pain; redraw(); } }),
      ]),

      el('div', { class: 'field' }, [
        el('label', {}, 'Note (optional)'),
        el('textarea', { rows: 2, oninput: e => draft.note = e.target.value }, draft.note || ''),
      ]),

      el('button', { class: 'btn primary block lg', onclick: save }, 'Save'),
    );
  }

  function save() {
    haptic('medium');
    S.logDaily(draft);
    toast('Saved — readiness updated', 'success');
    router.closeSheet();
    router.refresh();
  }
}

function sliderField(label, key, draft, onChange, labels) {
  return el('div', { class: 'field' }, [
    el('label', {}, [`${label}: `, el('strong', {}, labels[draft[key] - 1] || '?')]),
    el('div', { class: 'row-flex' }, [1,2,3,4,5].map(v => el('button', {
      class: `btn sm ${draft[key] === v ? 'primary' : ''}`,
      style: { flex: 1, padding: '6px 4px' },
      onclick: () => { draft[key] = v; haptic('light'); onChange(); },
    }, String(v)))),
  ]);
}

function numericField(label, key, min, max, step, draft, onChange, optional) {
  return el('div', { class: 'field' }, [
    el('label', {}, label + (optional ? ' (optional)' : '')),
    el('input', { type: 'number', min: String(min), max: String(max), step: String(step), value: draft[key] != null ? String(draft[key]) : '', oninput: e => {
      const v = parseFloat(e.target.value);
      draft[key] = Number.isFinite(v) ? v : null;
      onChange();
    }}),
  ]);
}

// ============== Movement screen ==============

export function renderMovementScreenSheet(sheetBody, ctx, router) {
  const s = S.get();
  const draft = {
    overheadSquat: s.movementScreen?.overheadSquat ?? 3,
    shoulderReach: s.movementScreen?.shoulderReach ?? 3,
    singleLegBalance: s.movementScreen?.singleLegBalance ?? 3,
    ankleDorsi: s.movementScreen?.ankleDorsi ?? 3,
    hipMobility: s.movementScreen?.hipMobility ?? 3,
  };
  redraw();
  function redraw() {
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Movement screen'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, '5-minute self-test. Rate each 1 (very limited) to 5 (excellent). Drives your mobility homework.'),

      testField('Overhead squat depth', 'overheadSquat', draft, redraw,
        'Bodyweight squat, arms straight overhead. Can you reach parallel without arms falling forward?'),
      testField('Shoulder reach', 'shoulderReach', draft, redraw,
        'One arm over the shoulder, one arm up the back. Can your fingers meet behind?'),
      testField('Single-leg balance (eyes closed)', 'singleLegBalance', draft, redraw,
        'Stand on one foot, eyes closed. Hold 30s without falling?'),
      testField('Ankle dorsiflexion', 'ankleDorsi', draft, redraw,
        'Front foot 4" from wall, can your knee touch without heel lifting?'),
      testField('Hip mobility', 'hipMobility', draft, redraw,
        '90/90 sit — front leg 90°, back leg 90°. Can you sit upright?'),

      el('button', { class: 'btn primary block lg', onclick: save }, 'Save screen'),
    );
  }
  function save() {
    const screen = { ...draft, weakLinks: weakLinksFrom(draft) };
    S.saveMovementScreen(screen);
    toast(screen.weakLinks.length ? `Flagged: ${screen.weakLinks.join(', ')}` : 'No weak links — solid foundation!', 'success');
    router.closeSheet();
    router.refresh();
  }
}

function testField(name, key, draft, onChange, description) {
  return el('div', { class: 'card flat', style: { padding: '10px' } }, [
    el('div', { style: { fontWeight: 600 } }, name),
    el('div', { class: 'faint', style: { fontSize: '12px', margin: '4px 0' } }, description),
    el('div', { class: 'row-flex' }, [1,2,3,4,5].map(v => el('button', {
      class: `btn sm ${draft[key] === v ? 'primary' : ''}`, style: { flex: 1 },
      onclick: () => { draft[key] = v; haptic('light'); onChange(); },
    }, String(v)))),
  ]);
}

// ============== Mobility routine ==============

export function renderMobilitySheet(sheetBody, ctx, router) {
  const screen = S.get().movementScreen;
  const drills = drillsForWeakLinks(screen?.weakLinks || []);
  sheetBody.replaceChildren(
    el('div', { class: 'grabber' }),
    el('h2', { style: { margin: '0 0 4px' } }, 'Today\'s mobility'),
    el('p', { class: 'muted', style: { marginTop: 0 } },
      screen?.weakLinks?.length
        ? `Targeted at your weak links: ${screen.weakLinks.join(', ')}`
        : 'General mobility — take a movement screen for targeted work.'),

    el('div', { class: 'list' }, drills.map((d, i) => el('div', { class: 'list-item' }, [
      el('div', { style: { flex: 1 } }, [
        el('div', { style: { fontWeight: 600 } }, `${i + 1}. ${d.name}`),
        el('div', { class: 'faint', style: { fontSize: '13px' } }, d.cue),
      ]),
      el('span', { class: 'pill' }, `${d.durationSec}s`),
    ]))),

    el('button', { class: 'btn primary block lg', onclick: () => {
      S.markMobilityDone(Math.round(drills.reduce((a, d) => a + d.durationSec, 0) / 60));
      toast('Mobility done — well-played', 'success');
      router.closeSheet();
      router.refresh();
    } }, 'Mark done'),

    !screen ? el('button', { class: 'btn block ghost', onclick: () => { router.closeSheet(); router.openSheet('movementScreen'); } }, 'Take movement screen first →') : null,
  );
}

// ============== Voice session debrief ==============

export function renderVoiceDebriefSheet(sheetBody, ctx, router) {
  let transcript = '';
  let recognition = null;
  let recording = false;
  redraw();

  function redraw() {
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Voice debrief'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, 'Talk for 30s about how the session went. AI will summarize and save it to your notes.'),

      el('button', {
        class: `btn ${recording ? 'danger' : 'primary'} block lg`,
        onclick: toggleRecord,
      }, recording ? '⏹ Stop recording' : '🎤 Start recording'),

      el('div', { class: 'field' }, [
        el('label', {}, 'Transcript (edit if needed)'),
        el('textarea', { rows: 6, oninput: e => transcript = e.target.value, value: transcript }, transcript),
      ]),

      el('button', { class: 'btn primary block', onclick: saveAndSummarize, disabled: !transcript.trim() }, 'Summarize & save'),
      el('p', { class: 'faint', style: { fontSize: '12px', marginTop: '8px' } }, 'Speech recognition needs iOS 14.5+ and grants mic permission. If recording doesn\'t work, just type.'),
    );
  }

  function toggleRecord() {
    if (recording) { stopRec(); return; }
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast('Speech recognition not available — type your note instead.', 'error');
      return;
    }
    const SR = /** @type {any} */ (window).SpeechRecognition || /** @type {any} */ (window).webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let finalText = transcript;
    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      transcript = finalText + interim;
      const ta = sheetBody.querySelector('textarea');
      if (ta) ta.value = transcript;
    };
    recognition.onerror = (e) => { toast('Mic error: ' + e.error, 'error'); stopRec(); };
    recognition.onend = () => { recording = false; redraw(); };
    try {
      recognition.start();
      recording = true;
      haptic('medium');
      redraw();
    } catch (e) { toast('Could not start mic: ' + /** @type {any} */ (e)?.message, 'error'); }
  }
  function stopRec() {
    if (recognition) { try { recognition.stop(); } catch {} recognition = null; }
    recording = false;
    redraw();
  }

  async function saveAndSummarize() {
    haptic('light');
    const session = S.activeSession();
    const sessionId = session?.id || ctx?.sessionId || null;
    let summary = transcript;
    const settings = S.get().settings;
    if (settings.apiKey) {
      try {
        toast('Summarizing…');
        const raw = await callProvider(settings, [{
          role: 'user',
          content: `Summarize this gym session debrief in 2-3 short bullet points. Capture any pain, twinges, energy notes, or session-specific observations. No JSON, just bullets.\n\nTranscript:\n${transcript}`,
        }], { maxTokens: 300, systemOverride: 'You summarize gym session debriefs into short bullet points. Be terse.' });
        summary = raw;
      } catch (e) { /* fall back to raw transcript */ }
    }
    S.logVoiceNote(transcript, { sessionId, summary });
    toast('Note saved', 'success');
    router.closeSheet();
    router.refresh();
  }
}

// ============== Bloodwork ==============

export function renderBloodworkSheet(sheetBody, ctx, router) {
  const draft = {};
  sheetBody.replaceChildren(
    el('div', { class: 'grabber' }),
    el('h2', { style: { margin: '0 0 4px' } }, 'Log bloodwork'),
    el('p', { class: 'muted', style: { marginTop: 0 } }, 'Annual basics. Fill what you have — leave the rest blank.'),

    bField('Total cholesterol (mg/dL)', 'totalCholesterol', draft),
    bField('LDL (mg/dL)', 'ldl', draft),
    bField('HDL (mg/dL)', 'hdl', draft),
    bField('Fasted glucose (mg/dL)', 'glucose', draft),
    bField('Vitamin D (ng/mL)', 'vitD', draft),
    bField('Ferritin (ng/mL)', 'ferritin', draft),
    bField('Testosterone (ng/dL)', 'testosterone', draft),
    el('div', { class: 'field' }, [
      el('label', {}, 'Note (lab, fasting status, etc.)'),
      el('input', { type: 'text', oninput: e => draft.note = e.target.value }),
    ]),
    el('button', { class: 'btn primary block lg', onclick: () => {
      const filled = Object.values(draft).filter(v => typeof v === 'number' && v > 0).length;
      if (filled === 0) { toast('Add at least one value', 'error'); return; }
      S.logBloodwork(draft);
      toast('Saved', 'success');
      router.closeSheet(); router.refresh();
    } }, 'Save'),
  );
}

function bField(label, key, draft) {
  return el('div', { class: 'field' }, [
    el('label', {}, label),
    el('input', { type: 'number', step: '0.1', oninput: e => { const v = parseFloat(e.target.value); draft[key] = Number.isFinite(v) ? v : null; } }),
  ]);
}
