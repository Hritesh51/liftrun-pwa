import { el, fmtDate, fmtWeight, kgToLb, lbToKg, haptic, toast } from '../util.js';
import * as S from '../state.js';
import { lineChart } from '../charts.js';
import { openLightbox, confirmAction, deleteWithUndo } from '../ui.js';

export function render(view, router) {
  const s = S.get();
  const units = s.settings.units;
  const bw = s.body.slice().reverse().map(b => ({ x: new Date(b.date).getTime(), y: b.weightKg }));
  view.replaceChildren(el('div', {}, [
    el('div', { class: 'h-row' }, [el('h1', {}, 'Body')]),

    // ---- Weight ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, [`Weight (${units})`]),
      el('div', { class: 'row-flex', style: { marginTop: '8px' } }, [
        el('input', { id: 'bwIn', type: 'number', step: '0.1', placeholder: units === 'lb' ? '139' : '63', style: { flex: 1 } }),
        el('button', { class: 'btn primary', onclick: () => {
          const v = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('bwIn')).value);
          if (!v) return;
          const kg = units === 'lb' ? lbToKg(v) : v;
          S.logBody({ weightKg: kg });
          haptic('success'); toast('Logged', 'success'); router.refresh();
        } }, 'Log'),
      ]),
      bw.length > 1 ? lineChart(bw, { units }) : null,
    ]),

    // ---- Goal ----
    renderGoalCard(s, router),

    // ---- Tape measurements ----
    renderTapeCard(s, router),

    // ---- Progress photos ----
    renderPhotosCard(s, router),

    // ---- Pain log button ----
    el('div', { class: 'card flat' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', { class: 'eyebrow' }, ['Pain / twinges']),
        el('button', { class: 'btn sm', onclick: () => router.openSheet('pain') }, s.painLog?.length ? `${s.painLog.filter(p => p.status !== 'resolved').length} active` : 'Log a twinge'),
      ]),
      s.painLog?.length ? el('p', { class: 'faint', style: { margin: '6px 0 0' } }, `${s.painLog.length} total entries`) : null,
    ]),

    // ---- Movement screen ----
    el('div', { class: 'card flat' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', { class: 'eyebrow' }, ['Movement screen']),
        el('button', { class: 'btn sm', onclick: () => router.openSheet('movementScreen') }, s.movementScreen ? 'Retake' : 'Take test'),
      ]),
      s.movementScreen ? el('p', { class: 'faint', style: { margin: '6px 0 0' } }, [
        `Last: ${fmtDate(s.movementScreen.date)}`,
        s.movementScreen.weakLinks?.length ? ` · weak links: ${s.movementScreen.weakLinks.join(', ')}` : ' · no weak links',
      ]) : el('p', { class: 'faint', style: { margin: '6px 0 0' } }, '5-minute self-test → targeted mobility homework.'),
    ]),

    // ---- Mobility quick access ----
    el('div', { class: 'card flat' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', { class: 'eyebrow' }, ['Mobility — today']),
        el('button', { class: 'btn sm primary', onclick: () => router.openSheet('mobility') }, '5-min routine'),
      ]),
      el('p', { class: 'faint', style: { margin: '6px 0 0' } }, `Done last 7 days: ${s.mobilityDoneLog?.filter(m => Date.now() - new Date(m.date).getTime() < 7*86400000).length || 0}`),
    ]),

    // ---- Bloodwork ----
    el('div', { class: 'card flat' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', { class: 'eyebrow' }, ['Bloodwork']),
        el('button', { class: 'btn sm', onclick: () => router.openSheet('bloodwork') }, 'Log results'),
      ]),
      s.bloodwork?.length
        ? el('p', { class: 'faint', style: { margin: '6px 0 0' } }, `Latest: ${fmtDate(s.bloodwork[0].date)} — ${Object.entries(s.bloodwork[0]).filter(([k,v]) => typeof v === 'number').slice(0,3).map(([k,v]) => `${k}: ${v}`).join(', ')}`)
        : el('p', { class: 'faint', style: { margin: '6px 0 0' } }, 'Annual basics: cholesterol, glucose, vitamin D. Get a panel ≥1×/year.'),
    ]),

    // ---- Weight history ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Weight history']),
      s.body.length ? el('div', { class: 'list' }, s.body.slice(0, 30).map(b => el('div', { class: 'list-item' }, [
        el('div', {}, [el('div', { style: { fontWeight: 600 } }, fmtWeight(b.weightKg, units)), el('div', { class: 'faint' }, fmtDate(b.date))]),
        el('button', { class: 'btn sm ghost danger', onclick: () => {
          const snap = { ...b };
          deleteWithUndo('weight entry', () => { S.deleteBody(b.id); router.refresh(); }, () => { S.logBody(snap); router.refresh(); });
        } }, '✕'),
      ]))) : el('p', { class: 'muted' }, 'No entries yet.'),
    ]),
  ]));
}

// ---------------- Goal card ----------------

function renderGoalCard(s, router) {
  const g = s.goals || {};
  const units = s.settings.units;
  return el('div', { class: 'card' }, [
    el('div', { class: 'eyebrow' }, ['Long-term goal']),
    el('div', { class: 'grid-2' }, [
      el('div', { class: 'field' }, [
        el('label', {}, `Target weight (${units})`),
        el('input', { type: 'number', step: '0.1', value: g.targetWeightKg ? (units === 'lb' ? (g.targetWeightKg * 2.20462).toFixed(1) : g.targetWeightKg) : '',
          oninput: e => {
            const v = parseFloat(e.target.value);
            S.setGoals({ targetWeightKg: isNaN(v) ? null : (units === 'lb' ? lbToKg(v) : v) });
          } }),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'By date'),
        el('input', { type: 'date', value: g.targetDate ? new Date(g.targetDate).toISOString().slice(0, 10) : '',
          oninput: e => S.setGoals({ targetDate: e.target.value ? new Date(e.target.value).toISOString() : null }) }),
      ]),
    ]),
    el('p', { class: 'faint', style: { margin: '4px 0 0' } }, 'Sustainable rates: +0.25–0.5 kg/week for lean gains, –0.3–0.7 kg/week for cuts.'),
  ]);
}

// ---------------- Tape card ----------------

function renderTapeCard(s, router) {
  const latest = s.tape[0];
  const series = (key) => s.tape.slice().reverse().map(t => ({ x: new Date(t.date).getTime(), y: t[key] })).filter(p => p.y != null);
  return el('div', { class: 'card' }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
      el('div', { class: 'eyebrow' }, ['Tape (cm) — every 2 weeks']),
      el('button', { class: 'btn sm', onclick: () => router.openSheet('addTape') }, '+ Add'),
    ]),
    latest ? el('div', { style: { marginTop: '6px' } }, [
      el('p', { class: 'faint', style: { margin: 0 } }, `Latest: ${fmtDate(latest.date)}`),
      el('div', { class: 'grid-2', style: { marginTop: '6px', gap: '6px' } }, [
        kv('Chest', latest.chestCm),
        kv('Arm (L/R)', latest.leftArmCm && latest.rightArmCm ? `${latest.leftArmCm}/${latest.rightArmCm}` : (latest.leftArmCm || latest.rightArmCm)),
        kv('Waist', latest.waistCm),
        kv('Thigh (L/R)', latest.leftThighCm && latest.rightThighCm ? `${latest.leftThighCm}/${latest.rightThighCm}` : (latest.leftThighCm || latest.rightThighCm)),
        kv('Calf (L/R)', latest.leftCalfCm && latest.rightCalfCm ? `${latest.leftCalfCm}/${latest.rightCalfCm}` : (latest.leftCalfCm || latest.rightCalfCm)),
        kv('Neck', latest.neckCm),
      ]),
      series('chestCm').length > 1 ? lineChart(series('chestCm'), {}) : null,
    ]) : el('p', { class: 'muted', style: { margin: '6px 0 0' } }, 'No entries yet. Take measurements every 2 weeks for honest hypertrophy signal.'),
  ]);
}

function kv(label, value) {
  return el('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line)' } }, [
    el('span', { class: 'faint' }, label),
    el('span', { style: { fontVariantNumeric: 'tabular-nums', fontWeight: 600 } }, value != null && value !== '' ? String(value) : '—'),
  ]);
}

// ---------------- Photos card ----------------

function renderPhotosCard(s, router) {
  return el('div', { class: 'card' }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
      el('div', { class: 'eyebrow' }, ['Progress photos']),
      el('div', { class: 'row-flex' }, [
        s.photos?.length >= 3 ? el('button', { class: 'btn sm', onclick: () => playMontage(s, router) }, '▶ Montage') : null,
        el('button', { class: 'btn sm', onclick: () => router.openSheet('addPhoto') }, '+ Add'),
      ]),
    ]),
    el('p', { class: 'faint', style: { margin: '4px 0 8px' } }, 'Weekly, same time/light, three poses (front, side, back). Stored locally — never uploaded.'),
    s.photos?.length ? el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' } },
      s.photos.slice(0, 9).map(p => {
        const imgEl = /** @type {HTMLImageElement} */ (el('img', { style: { width: '100%', height: '100%', objectFit: 'cover' }, alt: p.pose, loading: 'lazy' }));
        // Async-load image bytes from IndexedDB.
        S.getPhotoData(p).then(url => { if (url) { imgEl.src = url; imgEl.onclick = () => openLightbox(url, `${p.pose || ''} · ${fmtDate(p.date)}`); } });
        return el('div', { style: { position: 'relative', aspectRatio: '3/4', overflow: 'hidden', borderRadius: '8px', background: 'var(--bg-3)', cursor: 'pointer' } }, [
          imgEl,
          el('div', { style: { position: 'absolute', bottom: '2px', left: '4px', fontSize: '9px', color: '#fff', textShadow: '0 1px 2px #000', pointerEvents: 'none' } }, `${p.pose || ''} · ${new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`),
          el('button', { class: 'btn sm ghost danger', style: { position: 'absolute', top: '2px', right: '2px', padding: '2px 6px', fontSize: '10px' }, onclick: async (e) => {
            e.stopPropagation();
            const yes = await confirmAction({ title: 'Delete photo?', body: 'You can undo this immediately.', confirmLabel: 'Delete' });
            if (!yes) return;
            const url = await S.getPhotoData(p);
            const snapshot = { ...p, dataURL: url };
            deleteWithUndo('photo', () => { S.deletePhoto(p.id); router.refresh(); }, () => { S.logPhoto(snapshot); router.refresh(); });
          } }, '✕'),
        ]);
      })) : el('p', { class: 'muted' }, 'No photos yet.'),
  ]);
}

// Time-lapse: stitches photos into a quick auto-advancing overlay.
function playMontage(s, router) {
  const photos = s.photos.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (!photos.length) return;
  const back = document.createElement('div');
  back.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
  const img = document.createElement('img');
  img.style.cssText = 'max-width:100%;max-height:80vh;object-fit:contain;';
  const cap = document.createElement('div');
  cap.style.cssText = 'color:#fff;margin-top:12px;font-size:14px;font-weight:600;';
  const close = document.createElement('button');
  close.textContent = '✕ Close';
  close.style.cssText = 'position:absolute;top:env(safe-area-inset-top, 16px);right:16px;padding:8px 14px;border-radius:20px;background:rgba(255,255,255,.15);color:#fff;border:0;font-weight:600;';
  back.appendChild(img); back.appendChild(cap); back.appendChild(close);
  document.body.appendChild(back);
  let i = 0;
  const advance = async () => {
    if (i >= photos.length) { back.remove(); clearInterval(tid); return; }
    const p = photos[i];
    const url = await S.getPhotoData(p);
    if (url) img.src = url;
    cap.textContent = `${p.pose || ''} · ${new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} (${i + 1}/${photos.length})`;
    i++;
  };
  advance();
  const tid = setInterval(advance, 900);
  close.onclick = () => { back.remove(); clearInterval(tid); };
}

// ---------------- Sheets ----------------

export function renderTapeSheet(sheetBody, ctx, router) {
  const draft = {};
  sheetBody.replaceChildren(
    el('div', { class: 'grabber' }),
    el('h2', { style: { margin: '0 0 4px' } }, 'Add tape measurements'),
    el('p', { class: 'muted', style: { marginTop: 0 } }, 'All fields are optional — fill what you measured.'),
    field('Chest (cm)', 'chestCm', draft),
    el('div', { class: 'grid-2' }, [field('Left arm', 'leftArmCm', draft), field('Right arm', 'rightArmCm', draft)]),
    field('Waist (cm)', 'waistCm', draft),
    el('div', { class: 'grid-2' }, [field('Left thigh', 'leftThighCm', draft), field('Right thigh', 'rightThighCm', draft)]),
    el('div', { class: 'grid-2' }, [field('Left calf', 'leftCalfCm', draft), field('Right calf', 'rightCalfCm', draft)]),
    field('Neck (cm)', 'neckCm', draft),
    el('button', { class: 'btn primary block lg', onclick: () => {
      const filledCount = Object.values(draft).filter(v => typeof v === 'number' && v > 0).length;
      if (filledCount === 0) { toast('Enter at least one measurement', 'error'); return; }
      S.logTape(draft);
      toast(`Saved ${filledCount} measurement${filledCount > 1 ? 's' : ''}`, 'success');
      router.closeSheet(); router.refresh();
    } }, 'Save'),
  );
}

function field(label, key, draft) {
  return el('div', { class: 'field' }, [
    el('label', {}, label),
    el('input', { type: 'number', step: '0.1', placeholder: '–', oninput: e => draft[key] = e.target.value ? parseFloat(e.target.value) : null }),
  ]);
}

export function renderPhotoSheet(sheetBody, ctx, router) {
  let pose = 'front';
  let dataURL = null;
  redraw();
  function redraw() {
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Add progress photo'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, 'Same lighting, same time of day, no flexing. Stored locally only.'),
      el('div', { class: 'row-flex', style: { margin: '8px 0' } }, [
        ...['front', 'side', 'back'].map(p => el('button', { class: `btn sm ${pose === p ? 'primary' : ''}`, onclick: () => { pose = p; redraw(); } }, p)),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Take or choose photo'),
        el('input', { type: 'file', accept: 'image/*', onchange: handleFile }),
      ]),
      dataURL ? el('img', { src: dataURL, style: { maxWidth: '100%', borderRadius: '12px', maxHeight: '300px', objectFit: 'contain', display: 'block', margin: '8px auto' } }) : null,
      dataURL ? el('button', { class: 'btn primary block lg', onclick: save }, 'Save photo') : null,
    );
  }
  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      // Compress before storing
      dataURL = await compress(reader.result, 1200, 0.8);
      redraw();
    };
    reader.readAsDataURL(f);
  }
  function save() {
    try {
      S.logPhoto({ dataURL, pose });
    } catch (e) {
      // localStorage quota — most likely
      toast('Storage full. Export JSON + delete old photos.', 'error');
      return;
    }
    const count = S.get().photos?.length || 0;
    if (count > 50) toast(`Saved (${count} photos — consider exporting + pruning soon).`, 'success');
    else toast('Saved', 'success');
    router.closeSheet(); router.refresh();
  }
}

function compress(dataURL, maxSide, quality) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = rej;
    img.src = dataURL;
  });
}
