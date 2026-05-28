// Density training timers for home conditioning: EMOM, AMRAP, and Circuit (rounds-for-time).
import { el, haptic, fmtDuration } from '../util.js';
import { speak } from '../setextras.js';

export function renderDensitySheet(sheetBody, ctx, router) {
  let mode = 'emom';       // 'emom' | 'amrap' | 'circuit'
  let minutes = 10;
  let intervalSec = 60;    // EMOM interval
  let running = false;
  let tickHandle = null;
  let startTs = 0;
  let audioCtx = null;

  redraw();

  function redraw() {
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Density timer'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, 'Conditioning + work capacity. Great for home finishers.'),

      el('div', { class: 'row-flex', style: { margin: '8px 0' } }, [
        modeBtn('emom', 'EMOM'),
        modeBtn('amrap', 'AMRAP'),
        modeBtn('circuit', 'Stopwatch'),
      ]),

      el('p', { class: 'faint', style: { margin: '0 0 8px' } }, {
        emom: 'Every Minute On the Minute — do the prescribed reps at the start of each interval, rest the remainder.',
        amrap: 'As Many Rounds As Possible — keep moving for the full duration.',
        circuit: 'Open stopwatch — race your rounds.',
      }[mode]),

      mode !== 'circuit' ? el('div', { class: 'grid-2' }, [
        el('div', { class: 'field' }, [
          el('label', {}, 'Total minutes'),
          el('input', { type: 'number', min: '1', max: '60', value: String(minutes), oninput: e => minutes = Math.max(1, parseInt(e.target.value, 10) || 10) }),
        ]),
        mode === 'emom' ? el('div', { class: 'field' }, [
          el('label', {}, 'Interval (sec)'),
          el('select', { onchange: e => intervalSec = parseInt(e.target.value, 10) }, [
            el('option', { value: '30', selected: intervalSec === 30 }, '30s'),
            el('option', { value: '60', selected: intervalSec === 60 }, '60s'),
            el('option', { value: '90', selected: intervalSec === 90 }, '90s'),
            el('option', { value: '120', selected: intervalSec === 120 }, '2 min'),
          ]),
        ]) : el('div'),
      ]) : null,

      el('div', { id: 'densityDisplay', style: { textAlign: 'center', margin: '16px 0', minHeight: '80px' } }),

      el('button', { class: `btn ${running ? 'danger' : 'primary'} block lg`, onclick: () => running ? stop() : start() },
        running ? '⏹ Stop' : '▶ Start'),
    );
    if (running) paint();
  }

  function modeBtn(id, label) {
    return el('button', { class: `btn sm ${mode === id ? 'primary' : ''}`, style: { flex: 1 }, onclick: () => { if (!running) { mode = id; redraw(); } } }, label);
  }

  function beep(freq = 880, dur = 0.12) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.start(); o.stop(audioCtx.currentTime + dur + 0.02);
    } catch {}
  }

  let lastInterval = -1;
  function paint() {
    const disp = document.getElementById('densityDisplay');
    if (!disp) return;
    const elapsed = (Date.now() - startTs) / 1000;
    if (mode === 'circuit') {
      disp.innerHTML = `<div style="font-size:44px;font-weight:800;font-variant-numeric:tabular-nums">${fmtDuration(elapsed)}</div><div class="faint">elapsed</div>`;
      return;
    }
    const total = minutes * 60;
    const remain = Math.max(0, total - elapsed);
    if (remain <= 0) { stop(); speak('Time.'); return; }
    if (mode === 'emom') {
      const intervalNum = Math.floor(elapsed / intervalSec);
      const inInterval = elapsed % intervalSec;
      const intoRemain = Math.ceil(intervalSec - inInterval);
      if (intervalNum !== lastInterval) { lastInterval = intervalNum; beep(990, 0.15); haptic('medium'); }
      else if (intoRemain <= 3 && Math.abs(intoRemain - inInterval) < 0.3) { beep(660, 0.06); }
      disp.innerHTML = `<div style="font-size:13px;color:var(--text-faint);text-transform:uppercase">Interval ${intervalNum + 1}</div>
        <div style="font-size:48px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--accent)">${intoRemain}</div>
        <div class="faint">total left: ${fmtDuration(remain)}</div>`;
    } else { // amrap
      disp.innerHTML = `<div style="font-size:48px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--accent)">${fmtDuration(remain)}</div><div class="faint">keep going</div>`;
    }
  }

  function start() {
    running = true; startTs = Date.now(); lastInterval = -1;
    haptic('success'); beep(880, 0.15); speak(mode === 'emom' ? 'EMOM. Go.' : mode === 'amrap' ? 'AMRAP. Go.' : 'Go.');
    tickHandle = setInterval(paint, 200);
    redraw();
  }
  function stop() {
    running = false;
    clearInterval(tickHandle);
    haptic('light');
    redraw();
  }

  // Clean up on sheet close
  router.onSheetClose = () => { running = false; clearInterval(tickHandle); };
}
