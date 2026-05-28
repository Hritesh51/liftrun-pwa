import { el, fmtDate, fmtDistance, fmtDuration, fmtPace, haptic, toast } from '../util.js';
import * as S from '../state.js';
import { predictTime, trainingPaces, hrZones, buildRacePlan } from '../race.js';
import { confirmAction, deleteWithUndo, skeleton, emptyState } from '../ui.js';

let watchId = null;
let activeRun = null; // { startedAt, lastTick, distance, points: [{lat,lng,ts,d}], lastPos }
let tickHandle = null;

export function render(view, router) {
  const s = S.get();
  const runs = s.runs.slice(0, 30);

  view.replaceChildren(el('div', {}, [
    el('div', { class: 'h-row' }, [el('h1', {}, 'Running')]),

    el('div', { class: 'card' }, activeRun ? renderActiveRun(view, router) : [
      el('p', { class: 'muted', style: { margin: '0 0 8px' } }, 'Tap Start to track via GPS (keep the app open + screen on). Or log manually below.'),
      el('div', { class: 'row-flex' }, [
        el('button', { class: 'btn primary lg', onclick: () => startRun(view, router) }, 'Start GPS run'),
        el('button', { class: 'btn', onclick: () => router.openSheet('manualRun') }, 'Log manually'),
      ]),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Recent']),
      runs.length ? el('div', { class: 'list' }, runs.map(r => el('div', { class: 'list-item' }, [
        el('div', {}, [
          el('div', { style: { fontWeight: 600 } }, [fmtDate(r.date), r.source === 'healthKit' ? el('span', { class: 'pill good', style: { marginLeft: '6px', fontSize: '10px' } }, 'Health') : null]),
          el('div', { class: 'faint' }, `${fmtDistance(r.distanceMeters, s.settings.units)} · ${fmtDuration(r.durationSeconds)} · ${fmtPace(secPerKm(r), s.settings.units)}${r.avgHR ? ' · ' + r.avgHR + ' bpm' : ''}`),
        ]),
        el('button', { class: 'btn sm ghost danger', onclick: () => {
          const snap = { ...r };
          deleteWithUndo('run', () => { S.deleteRun(r.id); router.refresh(); }, () => { S.logRun(snap); router.refresh(); });
        } }, '✕'),
      ]))) : emptyState({ glyph: 'run', title: 'No runs yet', body: 'Start a GPS run or log one manually. Easy Zone-2 keeps your legs fresh for Leg day.', actionLabel: 'Log a run', onAction: () => router.openSheet('manualRun') }),
    ]),

    weeklyMileageCard(),

    // HR zones
    renderHRZonesCard(s, router),

    // Race planner
    renderRaceCard(s, router),

    // Pace predictor
    renderPacePredictorCard(s, router),
  ]));
}

// ---------------- HR zones ----------------
function renderHRZonesCard(s, router) {
  const zones = hrZones(s.hrZones?.maxHR, s.hrZones?.restingHR);
  return el('div', { class: 'card' }, [
    el('div', { class: 'eyebrow' }, ['Heart rate zones']),
    el('div', { class: 'grid-2' }, [
      el('div', { class: 'field' }, [
        el('label', {}, 'Max HR (bpm)'),
        el('input', { type: 'number', placeholder: '~195', value: s.hrZones?.maxHR || '', oninput: e => S.setHRZones({ maxHR: parseInt(e.target.value, 10) || null }) }),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Resting HR'),
        el('input', { type: 'number', placeholder: '~55', value: s.hrZones?.restingHR || '', oninput: e => S.setHRZones({ restingHR: parseInt(e.target.value, 10) || null }) }),
      ]),
    ]),
    zones ? el('div', { style: { marginTop: '6px' } }, [
      el('p', { class: 'faint' }, 'Karvonen if resting HR set. Most runs should be Z2 (Easy).'),
      el('div', { class: 'list' }, Object.entries(zones).map(([k, z]) => el('div', { class: 'list-item' }, [
        el('div', {}, [el('div', { style: { fontWeight: 600 } }, `${k.toUpperCase()} · ${z.name}`)]),
        el('span', { class: 'meta' }, `${z.low}–${z.high} bpm`),
      ]))),
    ]) : el('p', { class: 'faint' }, 'Enter your max HR to compute zones. Rough formula: 220 − age, but a self-tested max is much more accurate.'),
  ]);
}

// ---------------- Race planner ----------------
function renderRaceCard(s, router) {
  const r = s.raceGoal;
  if (!r) {
    return el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Race goal']),
      el('p', { class: 'faint' }, 'Pick a race date and goal time. The app builds a plan and reduces leg-lift volume during peak/taper.'),
      el('button', { class: 'btn primary', onclick: () => router.openSheet('raceSetup') }, 'Set a race goal'),
    ]);
  }
  const plan = buildRacePlan(r);
  return el('div', { class: 'card' }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
      el('div', { class: 'eyebrow' }, ['Race goal']),
      el('button', { class: 'btn sm ghost', onclick: async () => { if (await confirmAction({ title: 'Clear race goal?', confirmLabel: 'Clear' })) { S.setRaceGoal(null); router.refresh(); } } }, 'Clear'),
    ]),
    el('p', {}, `${(r.distanceMeters / 1000).toFixed(1)} km in ${fmtDuration(r.targetSeconds)} on ${fmtDate(r.raceDate)} · ${plan ? plan.daysToRace + ' days away' : ''}`),
    plan ? el('div', { class: 'list', style: { marginTop: '8px' } }, plan.phases.slice(0, 8).map(p => el('div', { class: 'list-item' }, [
      el('div', {}, [
        el('div', { style: { fontWeight: 600 } }, `Week ${p.weekNum} · ${p.phase}`),
        el('div', { class: 'faint' }, p.sessions.map(s => s.label).join(' · ')),
        p.legLiftIntensity < 1 ? el('div', { class: 'faint', style: { color: 'var(--warn)' } }, `Leg lift intensity: ${Math.round(p.legLiftIntensity * 100)}% of normal`) : null,
      ]),
    ]))) : null,
  ]);
}

export function renderRaceSetupSheet(sheetBody, ctx, router) {
  const draft = { distanceMeters: 5000, raceDate: '', targetMinutes: 25, targetSeconds: 0 };
  sheetBody.replaceChildren(
    el('div', { class: 'grabber' }),
    el('h2', { style: { margin: '0 0 12px' } }, 'Race goal'),
    el('div', { class: 'field' }, [
      el('label', {}, 'Distance'),
      el('select', { onchange: e => { draft.distanceMeters = parseInt(e.target.value, 10); } }, [
        el('option', { value: '5000' }, '5K'),
        el('option', { value: '10000' }, '10K'),
        el('option', { value: '21097' }, 'Half marathon'),
        el('option', { value: '42195' }, 'Marathon'),
      ]),
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Race date'),
      el('input', { type: 'date', oninput: e => { draft.raceDate = e.target.value; } }),
    ]),
    el('div', { class: 'grid-2' }, [
      el('div', { class: 'field' }, [
        el('label', {}, 'Goal min'),
        el('input', { type: 'number', value: '25', oninput: e => { draft.targetMinutes = parseInt(e.target.value, 10) || 25; } }),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Goal sec'),
        el('input', { type: 'number', value: '0', oninput: e => { draft.targetSeconds = parseInt(e.target.value, 10) || 0; } }),
      ]),
    ]),
    el('button', { class: 'btn primary block lg', onclick: () => {
      if (!draft.raceDate) { toast('Pick a date', 'error'); return; }
      S.setRaceGoal({
        distanceMeters: draft.distanceMeters,
        raceDate: new Date(draft.raceDate).toISOString(),
        targetSeconds: draft.targetMinutes * 60 + draft.targetSeconds,
      });
      toast('Race goal saved', 'success');
      router.closeSheet();
      router.refresh();
    } }, 'Save race'),
  );
}

// ---------------- Pace predictor ----------------
function renderPacePredictorCard(s, router) {
  // Use the fastest run in last 60 days as the basis
  const since = Date.now() - 60 * 86400000;
  const runs = s.runs.filter(r => new Date(r.date).getTime() >= since && r.distanceMeters > 1000);
  const best = runs.sort((a, b) => (a.durationSeconds / a.distanceMeters) - (b.durationSeconds / b.distanceMeters))[0];
  const predict = (d) => best ? predictTime(best.distanceMeters, best.durationSeconds, d) : null;
  return el('div', { class: 'card' }, [
    el('div', { class: 'eyebrow' }, ['Race-pace predictor']),
    best
      ? el('div', { style: { marginTop: '8px' } }, [
          el('p', { class: 'faint', style: { margin: 0 } }, `From your fastest run in last 60d: ${fmtDistance(best.distanceMeters, s.settings.units)} in ${fmtDuration(best.durationSeconds)}`),
          el('div', { class: 'grid-2', style: { marginTop: '6px' } }, [
            ['5K', 5000], ['10K', 10000], ['Half marathon', 21097], ['Marathon', 42195],
          ].map(([n, d]) => {
            const sec = predict(d);
            return el('div', { class: 'card flat', style: { padding: '10px' } }, [
              el('div', { class: 'eyebrow' }, [n]),
              el('div', { style: { fontWeight: 700, fontSize: '18px', fontVariantNumeric: 'tabular-nums', marginTop: '4px' } }, sec ? fmtDuration(sec) : '—'),
            ]);
          })),
          el('p', { class: 'faint', style: { marginTop: '6px' } }, "Riegel formula — surprisingly accurate. Hold long-run paces honestly to keep this realistic."),
        ])
      : el('p', { class: 'faint' }, 'Log at least one 1km+ run and the predictor will appear.'),
  ]);
}

function secPerKm(r) {
  if (!r.distanceMeters || !r.durationSeconds) return 0;
  return r.durationSeconds / (r.distanceMeters / 1000);
}

function renderActiveRun(view, router) {
  return [
    el('div', { id: 'liveStats', style: { textAlign: 'center', margin: '8px 0' } }),
    el('div', { class: 'row-flex', style: { justifyContent: 'space-between', marginTop: '8px' } }, [
      el('button', { class: 'btn danger', onclick: () => stopRun(view, router, true) }, 'Discard'),
      el('button', { class: 'btn primary lg', onclick: () => stopRun(view, router, false) }, 'Save run'),
    ]),
  ];
}

function paintLiveStats() {
  if (!activeRun) return;
  const node = document.getElementById('liveStats');
  if (!node) return;
  const units = S.get().settings.units;
  const dur = (Date.now() - activeRun.startedAt) / 1000;
  const pace = activeRun.distance > 50 ? dur / (activeRun.distance / 1000) : 0;
  node.innerHTML = `
    <div style="font-size:13px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.08em">Distance</div>
    <div style="font-size:48px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1">${(activeRun.distance / (units === 'lb' ? 1609.344 : 1000)).toFixed(2)} <span style="font-size:18px;color:var(--text-faint)">${units === 'lb' ? 'mi' : 'km'}</span></div>
    <div style="display:flex;justify-content:space-around;margin-top:14px">
      <div><div style="font-size:11px;color:var(--text-faint);text-transform:uppercase">Time</div><div style="font-weight:700;font-variant-numeric:tabular-nums">${fmtDuration(dur)}</div></div>
      <div><div style="font-size:11px;color:var(--text-faint);text-transform:uppercase">Pace</div><div style="font-weight:700;font-variant-numeric:tabular-nums">${fmtPace(pace, units)}</div></div>
    </div>
  `;
}

function startRun(view, router) {
  if (!('geolocation' in navigator)) {
    toast('GPS unavailable on this device — use manual log.', 'error');
    return;
  }
  haptic('medium');
  activeRun = { startedAt: Date.now(), distance: 0, points: [], lastPos: null };
  watchId = navigator.geolocation.watchPosition((pos) => {
    const { latitude: lat, longitude: lng } = pos.coords;
    if (activeRun.lastPos) {
      const d = haversine(activeRun.lastPos.lat, activeRun.lastPos.lng, lat, lng);
      if (d < 200) activeRun.distance += d; // reject GPS jumps
    }
    activeRun.lastPos = { lat, lng };
    activeRun.points.push({ lat, lng, ts: Date.now() });
  }, (err) => { toast(`GPS error: ${err.message}`, 'error'); }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 });
  tickHandle = setInterval(paintLiveStats, 500);
  acquireWake();
  render(view, router);
}

function stopRun(view, router, discard) {
  haptic(discard ? 'light' : 'success');
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  clearInterval(tickHandle);
  releaseWake();
  if (!discard && activeRun.distance > 100) {
    S.logRun({
      date: new Date(activeRun.startedAt).toISOString(),
      source: 'inApp',
      distanceMeters: activeRun.distance,
      durationSeconds: (Date.now() - activeRun.startedAt) / 1000,
      route: activeRun.points,
    });
    toast('Run saved', 'success');
  }
  activeRun = null;
  render(view, router);
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

let wakeLock = null;
async function acquireWake() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {}
}
function releaseWake() { try { wakeLock?.release(); } catch {} wakeLock = null; }

function weeklyMileageCard() {
  const s = S.get();
  const week = Date.now() - 7 * 86400000;
  const km = s.runs.filter(r => new Date(r.date).getTime() >= week).reduce((a, r) => a + (r.distanceMeters || 0) / 1000, 0);
  const last2 = s.runs.filter(r => new Date(r.date).getTime() >= week - 7 * 86400000 && new Date(r.date).getTime() < week).reduce((a, r) => a + (r.distanceMeters || 0) / 1000, 0);
  const delta = last2 > 0 ? Math.round(((km - last2) / last2) * 100) : null;
  const units = s.settings.units;
  return el('div', { class: 'card' }, [
    el('div', { class: 'eyebrow' }, ['This week']),
    el('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' } }, [
      el('span', { style: { fontSize: '28px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' } }, units === 'lb' ? (km / 1.60934).toFixed(1) : km.toFixed(1)),
      el('span', { class: 'muted' }, units === 'lb' ? 'mi' : 'km'),
      delta != null ? el('span', { class: `pill ${delta > 12 ? 'warn' : delta < 0 ? '' : 'good'}` }, `${delta > 0 ? '+' : ''}${delta}% vs prev`) : null,
    ]),
    el('p', { class: 'faint' }, '10% / week max — bigger jumps invite injuries.'),
  ]);
}

export function renderManualSheet(sheetBody, ctx, router) {
  const units = S.get().settings.units;
  sheetBody.replaceChildren(
    el('div', { class: 'grabber' }),
    el('h2', { style: { margin: '0 0 12px' } }, 'Log a run'),
    el('div', { class: 'field' }, [
      el('label', {}, `Distance (${units === 'lb' ? 'mi' : 'km'})`),
      el('input', { id: 'mDist', type: 'number', step: '0.01', placeholder: '5.0' }),
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Duration (mm:ss or hh:mm:ss)'),
      el('input', { id: 'mDur', type: 'text', placeholder: '30:00' }),
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'When'),
      el('input', { id: 'mDate', type: 'datetime-local' }),
    ]),
    el('div', { class: 'grid-2' }, [
      el('div', { class: 'field' }, [
        el('label', {}, 'Avg HR (optional)'),
        el('input', { id: 'mHR', type: 'number', placeholder: 'from your watch' }),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Effort'),
        el('select', { id: 'mIntensity' }, [
          el('option', { value: '0.7' }, 'Easy (Zone 2)'),
          el('option', { value: '0.85' }, 'Moderate (Zone 3)'),
          el('option', { value: '1.0' }, 'Hard (tempo/intervals)'),
        ]),
      ]),
    ]),
    el('button', { class: 'btn primary block lg', onclick: () => {
      const dist = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('mDist')).value);
      const durStr = /** @type {HTMLInputElement} */ (document.getElementById('mDur')).value;
      const parts = durStr.split(':').map(Number);
      let secs = 0;
      if (parts.length === 2) secs = parts[0] * 60 + parts[1];
      else if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else secs = parseFloat(durStr) || 0;
      if (!dist || !secs) { toast('Distance + duration required', 'error'); return; }
      const meters = units === 'lb' ? dist * 1609.344 : dist * 1000;
      const dateStr = /** @type {HTMLInputElement} */ (document.getElementById('mDate')).value;
      const hr = parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById('mHR'))?.value || '', 10);
      const intensity = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('mIntensity'))?.value || '');
      S.logRun({
        date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
        source: 'manual',
        distanceMeters: meters,
        durationSeconds: secs,
        avgHR: isNaN(hr) ? null : hr,
        intensity: isFinite(intensity) ? intensity : 0.7,
      });
      toast('Saved', 'success');
      router.closeSheet();
      router.refresh();
    } }, 'Save run'),
  );
}
