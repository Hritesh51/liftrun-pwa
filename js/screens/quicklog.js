// Conversational quick-log — type/dictate "did 3x8 bench at 60" and AI parses it.
import { el, toast, haptic, parseJsonLoose } from '../util.js';
import * as S from '../state.js';
import { callProvider } from '../coach.js';
import { EXERCISE_INDEX } from '../seed.js';

export function renderQuickLogSheet(sheetBody, ctx, router) {
  let pending = null; // parsed structured array
  redraw();

  function redraw() {
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Quick log'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, "Type or dictate sets in plain English. AI parses and stages them. You confirm before saving."),
      el('div', { class: 'field' }, [
        el('label', {}, 'What did you just do?'),
        el('textarea', { id: 'qlIn', rows: 4, placeholder: 'e.g. "Did 3 sets of bench, 60 kg, 8 8 7" or "incline DB 22.5 kg, 10 10 8 rpe 8"', autofocus: true }),
      ]),
      el('div', { class: 'row-flex' }, [
        el('button', { class: 'btn', onclick: toggleMic, id: 'micBtn' }, '🎤 Dictate'),
        el('button', { class: 'btn primary lg', onclick: parse }, 'Parse'),
        el('button', { class: 'btn ghost', onclick: () => router.closeSheet() }, 'Cancel'),
      ]),
      pending ? renderPending() : null,
    );
  }

  function renderPending() {
    return el('div', { class: 'card flat', style: { marginTop: '12px' } }, [
      el('div', { class: 'eyebrow' }, ['Staged sets']),
      el('div', { class: 'list' }, pending.map(p => el('div', { class: 'list-item' }, [
        el('div', {}, [
          el('div', { style: { fontWeight: 600 } }, EXERCISE_INDEX[p.exerciseId]?.name || p.exerciseId),
          el('div', { class: 'faint' }, `${p.reps} reps @ ${p.weightKg}kg${p.rpe ? ' · RPE ' + p.rpe : ''}${p.type !== 'working' ? ' · ' + p.type : ''}`),
        ]),
      ]))),
      el('button', { class: 'btn primary block lg', onclick: confirmSave }, `Save ${pending.length} set${pending.length > 1 ? 's' : ''}`),
    ]);
  }

  let micRec = null;
  function toggleMic() {
    if (micRec) { try { micRec.stop(); } catch {} micRec = null; /** @type {HTMLElement} */ (document.getElementById('micBtn')).textContent = '🎤 Dictate'; return; }
    const SR = /** @type {any} */ (window).SpeechRecognition || /** @type {any} */ (window).webkitSpeechRecognition;
    if (!SR) { toast('Speech recognition not available', 'error'); return; }
    micRec = new SR();
    micRec.continuous = true;
    micRec.interimResults = true;
    micRec.lang = 'en-US';
    const ta = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('qlIn'));
    if (!ta) return;
    let finalText = ta.value;
    micRec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      ta.value = finalText + interim;
    };
    micRec.onend = () => { micRec = null; const b = document.getElementById('micBtn'); if (b) b.textContent = '🎤 Dictate'; };
    micRec.onerror = (e) => { toast('Mic error: ' + e.error, 'error'); micRec = null; };
    try { micRec.start(); /** @type {HTMLElement} */ (document.getElementById('micBtn')).textContent = '⏹ Stop'; haptic('medium'); }
    catch (e) { toast('Mic start failed', 'error'); }
  }

  async function parse() {
    const text = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('qlIn'))?.value?.trim();
    if (!text) { toast('Type something first', 'error'); return; }
    haptic('light');
    toast('Parsing…');
    const exerciseList = Object.entries(EXERCISE_INDEX).map(([id, e]) => `${id}: ${e.name}`).join('\n');
    const prompt = `Parse this lifting log line into JSON. Return ONLY a JSON array; no prose.
Each entry: { "exerciseId": "<id from list>", "weightKg": number, "reps": number, "rpe": number|null, "type": "working"|"warmup"|"drop"|"failure" }.
If multiple sets, return one entry per set.
Match the exercise to the closest from this list (use the exact id):
${exerciseList}

User input: "${text}"`;
    try {
      const raw = await callProvider(S.get().settings, [{ role: 'user', content: prompt }], {
        systemOverride: 'You convert lifting log notes into structured JSON. Respond with a JSON array only.',
        maxTokens: 800,
      });
      const parsed = parseJsonLoose(raw);
      if (!Array.isArray(parsed) || !parsed.length) throw new Error('No sets parsed');
      pending = parsed.filter(p => p.exerciseId && p.reps && p.weightKg != null);
      toast(`Parsed ${pending.length} set${pending.length > 1 ? 's' : ''}`, 'success');
      redraw();
    } catch (e) {
      toast(`Parse failed: ${/** @type {any} */ (e)?.message}`, 'error');
    }
  }

  function confirmSave() {
    const session = ctx?.session || S.activeSession();
    if (!session) { toast('No active session', 'error'); return; }
    haptic('success');
    for (const p of pending) {
      S.logSet({
        sessionId: session.id,
        exerciseId: p.exerciseId,
        weightKg: p.weightKg,
        reps: p.reps,
        rpe: p.rpe || null,
        type: p.type || 'working',
      });
    }
    toast(`Saved ${pending.length} set${pending.length > 1 ? 's' : ''}`, 'success');
    router.closeSheet();
    router.refresh();
  }
}
