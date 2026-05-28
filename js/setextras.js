// Tempo metronome + voice coaching cues for sets. Self-contained, uses Web Audio + SpeechSynthesis.
import { haptic } from './util.js';

// Parse "3-0-1-0" → { eccentric:3, pauseBottom:0, concentric:1, pauseTop:0 }
export function parseTempo(s) {
  if (!s) return null;
  const parts = String(s).split('-').map(Number);
  if (parts.length !== 4 || parts.some(p => !Number.isFinite(p))) return null;
  return { eccentric: parts[0], pauseBottom: parts[1], concentric: parts[2], pauseTop: parts[3] };
}

let tempoTimer = null;
let tempoCtx = null;

// Start a tempo metronome that ticks haptic+beep at each phase boundary, repeating for N reps.
/**
 * @param {{eccentric?:number, pauseBottom?:number, concentric?:number, pauseTop?:number}} tempo
 * @param {number} [reps]
 * @param {(phase: string, rep: number) => void} [onPhase]
 */
export function startTempo({ eccentric = 3, pauseBottom = 0, concentric = 1, pauseTop = 0 }, reps = 8, onPhase = () => {}) {
  stopTempo();
  const phases = [
    { name: 'down', dur: eccentric, freq: 660 },
    { name: 'pauseBottom', dur: pauseBottom, freq: 0 },
    { name: 'up', dur: concentric, freq: 880 },
    { name: 'pauseTop', dur: pauseTop, freq: 0 },
  ];
  let phaseIdx = 0; let rep = 0;
  function tick() {
    const p = phases[phaseIdx];
    if (p.dur > 0) {
      beep(p.freq, 0.06);
      haptic('light');
      onPhase(p.name, rep + 1);
    }
    phaseIdx = (phaseIdx + 1) % phases.length;
    if (phaseIdx === 0) {
      rep++;
      if (rep >= reps) { stopTempo(); onPhase('done', rep); return; }
    }
    const nextDur = (phases[phaseIdx].dur || 1) * 1000;
    tempoTimer = setTimeout(tick, nextDur);
  }
  tick();
}
export function stopTempo() {
  if (tempoTimer) { clearTimeout(tempoTimer); tempoTimer = null; }
}
export function isTempoRunning() { return tempoTimer !== null; }

function beep(freq, dur) {
  if (!freq) return;
  try {
    if (!tempoCtx) tempoCtx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
    const o = tempoCtx.createOscillator();
    const g = tempoCtx.createGain();
    o.connect(g); g.connect(tempoCtx.destination);
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.001, tempoCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, tempoCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, tempoCtx.currentTime + dur);
    o.start();
    o.stop(tempoCtx.currentTime + dur + 0.02);
  } catch {}
}

// One-line voice cue via Speech Synthesis. Used for mid-set audio coaching.
export function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1.0;
    u.volume = 1.0;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}

export function isAudioSupported() {
  return 'speechSynthesis' in window;
}
