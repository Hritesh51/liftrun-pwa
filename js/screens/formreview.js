// Form-review sheet: take a short video of a working set, extract a keyframe,
// send to a vision LLM with an exercise-specific form-cue prompt, return feedback.
import { el, toast, haptic } from '../util.js';
import * as S from '../state.js';
import { EXERCISE_INDEX } from '../seed.js';

const VISION_PROVIDERS = ['gemini', 'openai', 'anthropic'];

export function renderFormReviewSheet(sheetBody, ctx, router) {
  const exerciseId = ctx?.exerciseId || null;
  const ex = exerciseId ? EXERCISE_INDEX[exerciseId] : null;
  let frame = null; // dataURL of extracted keyframe
  let feedback = null;
  redraw();

  function redraw() {
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, `Form review${ex ? ' · ' + ex.name : ''}`),
      el('p', { class: 'muted', style: { marginTop: 0 } }, 'Upload a short video of one working set (5–15s). AI analyzes a keyframe near the bottom of the rep.'),
      el('div', { class: 'field' }, [
        el('label', {}, 'Pick a video or record'),
        el('input', { type: 'file', accept: 'video/*', onchange: handle }),
      ]),
      frame ? el('img', { src: frame, style: { maxWidth: '100%', borderRadius: '12px', maxHeight: '320px', objectFit: 'contain' } }) : null,
      feedback ? el('div', { class: 'card flat', style: { marginTop: '12px' } }, [
        el('div', { class: 'eyebrow' }, ['Feedback']),
        el('p', { style: { whiteSpace: 'pre-wrap', margin: '6px 0 0' } }, feedback),
      ]) : null,
      el('p', { class: 'faint', style: { marginTop: '8px' } }, 'Needs Gemini, OpenAI, or Anthropic for vision. Switch provider in Settings if needed.'),
    );
  }

  async function handle(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    haptic('light');
    toast('Extracting keyframe…');
    try {
      frame = await extractMidFrame(URL.createObjectURL(f));
      redraw();
      toast('Analyzing form…');
      feedback = await reviewForm(frame, ex);
      redraw();
      toast('Done', 'success');
    } catch (err) {
      toast(`Failed: ${/** @type {any} */ (err)?.message}`, 'error');
    }
  }
}

// Extract a frame from the middle of the video. Bails out after 10s if decode hangs.
async function extractMidFrame(videoURL) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    let done = false;
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      try { v.src = ''; } catch {}
      reject(new Error('Video decode timed out (10s). Try a shorter clip or different format.'));
    }, 10000);
    const finish = (fn) => (val) => { if (done) return; done = true; clearTimeout(timeout); fn(val); };
    const onErr = finish(reject);
    const ok = finish(resolve);

    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    v.src = videoURL;
    v.onloadedmetadata = () => {
      try { v.currentTime = Math.min(v.duration * 0.5, 3); }
      catch (e) { onErr(new Error('Could not seek video')); }
    };
    v.onseeked = () => {
      try {
        const c = document.createElement('canvas');
        c.width = Math.min(1280, v.videoWidth || 640);
        c.height = c.width * ((v.videoHeight || 1) / (v.videoWidth || 1));
        /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).drawImage(v, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.8));
      } catch (e) { onErr(e); }
    };
    v.onerror = () => onErr(new Error('Could not read video'));
  });
}

async function reviewForm(dataURL, exercise) {
  const settings = S.get().settings;
  if (!VISION_PROVIDERS.includes(settings.aiProvider)) {
    throw new Error('Vision needs Gemini, OpenAI, or Anthropic. Switch in Settings.');
  }
  const cues = exercise ? exercise.cues.join(' / ') : '';
  const name = exercise?.name || 'unknown lift';
  const prompt = `You are a strength coach reviewing a single frame of "${name}". Coaching cues to check: ${cues}

Look at the lifter's:
- Bar path / hand position
- Joint angles (knees, elbows, hips, back)
- Depth / range of motion
- Visible asymmetries

Give 3 short bullet points of feedback, no preamble. Be specific. If the form looks good, say so honestly. If you can't see it clearly, say so. NEVER diagnose injuries — recommend a professional if pain is suggested.`;

  const base64 = dataURL.replace(/^data:image\/[a-z]+;base64,/, '');
  if (settings.aiProvider === 'gemini')   return await visionGemini(settings, prompt, base64);
  if (settings.aiProvider === 'openai')   return await visionOpenAI(settings, prompt, dataURL);
  return await visionAnthropic(settings, prompt, base64);
}

async function visionGemini(settings, prompt, base64) {
  const model = settings.aiModel || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: base64 } }, { text: prompt }] }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
}
async function visionOpenAI(settings, prompt, dataURL) {
  const model = settings.aiModel || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model, max_tokens: 600,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataURL } }] }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}
async function visionAnthropic(settings, prompt, base64) {
  const model = settings.aiModel || 'claude-opus-4-7';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model, max_tokens: 600,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text: prompt },
      ] }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data?.content || []).map(c => c.text || '').join('').trim();
}
