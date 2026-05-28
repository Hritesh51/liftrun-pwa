// CoachService — provider-agnostic LLM client for the AI coach.
// Anthropic and OpenAI adapters. Defensive JSON parsing. Local fallback when offline/unconfigured.
import * as S from './state.js';
import { suggestNextSet, weeklyReview, readinessAdvice, detectPlateaus } from './engine.js';
import { parseJsonLoose, e1RM } from './util.js';
import { EXERCISE_INDEX } from './seed.js';

// Default system prompt — for free-form chat. NEVER asks for JSON; that's a separate path.
const PERSONA_PREFIX = {
  balanced:   `You are this user's strength + running coach. Be calm, supportive, and evidence-based.`,
  strict:    `You are a strict, no-nonsense coach. Be direct, demanding, and hold the lifter accountable. Don't sugarcoat.`,
  supportive: `You are a warm, encouraging coach. Celebrate wins and gently redirect mistakes. Build confidence.`,
  hardcore:   `You are an intense, old-school coach. Push the lifter mentally. Use blunt language (but stay safe). No coddling.`,
};

const BASE_SYSTEM = `You are this user's strength + running coach.
- Their goal is hypertrophy (muscle growth). They are a brand-new lifter, ~63 kg, 168 cm, and also a runner.
- Be CONCISE and DIRECT. 2–4 sentences for a tip; a brief paragraph only when needed.
- Reply in plain, conversational prose. NEVER include JSON, code blocks, key/value pairs, or curly braces in your replies. NEVER include text like "suggestedWeightKg" or any structured-data formatting. Just talk normally to the user.
- Use evidence-based, mainstream programming. Double progression: hit the top of the rep range across all sets → add the smallest load, reset to the bottom.
- For a beginner: emphasize form before load. RPE 6–7 (3–4 reps in reserve) early; never push beginners to test true 1RM.
- Safety (OVERRIDES any persona): if the user reports SHARP or PERSISTENT pain, advise stopping that movement and seeing a qualified professional. Suggest a pain-free alternative.
- Nutrition: gentle, NEVER prescriptive calorie restriction; mention ~1.6–2.2 g protein per kg/day and slight surplus only when asked.
- Running: most runs easy Zone 2; never schedule hard runs day-before or day-of Legs; ~10% mileage rule.
- If the user is brand-new with no logged sets, do not invent numbers — recommend they start light and learn form first.
- TRAINING LOCATION: If the context shows trainingMode "home", ONLY suggest exercises doable with the listed homeEquipment (bodyweight, bands, dumbbells, pull-up bar, etc.). Progress home lifters via harder variations (e.g., incline → full → archer push-ups), tempo, range of motion, and unilateral work — NOT by "adding weight". If gym, machines/barbells/cables are fair game.
`.trim();

// Composes the final system prompt with the user's chosen persona.
function buildSystemPrompt() {
  const persona = S.get().settings?.coachPersona || 'balanced';
  return `${PERSONA_PREFIX[persona] || PERSONA_PREFIX.balanced}\n\n${BASE_SYSTEM}`;
}

// Public — call this to get the active persona-aware system prompt.
export { buildSystemPrompt };

// --- Public surface ---------------------------------------------------------

export function isConfigured() {
  const s = S.get();
  return !!(s.settings.apiKey && s.settings.apiKey.length > 10);
}

export async function chat(userText, opts = {}) {
  if (!isConfigured()) return { text: '(Coach offline — add an API key in Settings to enable AI replies.)', offline: true };
  if (!navigator.onLine) return { text: '(Offline — local progression is still working. The AI coach is unavailable until you have a connection.)', offline: true };

  const s = S.get();
  const ctx = buildContext({ includeHistoryWeeks: 4 });
  const messages = [
    ...(s.coachMessages || []).slice(-12).map(m => ({ role: m.role, content: m.text })),
    { role: 'user', content: opts.includeContext === false ? userText : `${userText}\n\n[Context for you — recent training, JSON]:\n${JSON.stringify(ctx)}` },
  ];
  try {
    const text = await callProvider(s.settings, messages);
    return { text: stripJsonNoise(text), offline: false };
  } catch (e) {
    console.error(e);
    return { text: `Coach error: ${/** @type {any} */ (e)?.message}`, offline: true, error: true };
  }
}

// Defensive: if the model leaks structured JSON / code fences into a chat reply,
// strip it client-side so the user sees clean prose. The dedicated suggestForSlot
// path uses parseJsonLoose on the raw text instead.
function stripJsonNoise(text) {
  if (!text) return text;
  let out = String(text);
  // Remove fenced code blocks entirely (the model sometimes wraps JSON in ```)
  out = out.replace(/```[\s\S]*?```/g, '').trim();
  // Remove obvious JSON-ish blobs containing our schema keys
  out = out.replace(/\{[^{}]*?(suggestedWeightKg|suggestedSetsReps|rpeCap)[^{}]*\}/gi, '').trim();
  // Remove leftover "Note:" or trailing colons
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out || text; // fall back to raw if we stripped everything
}

// Returns a suggestion object for the given exercise slot. Tries AI first, falls back to local.
export async function suggestForSlot(exerciseId, slot) {
  const local = suggestNextSet(exerciseId, slot);
  if (!isConfigured() || !navigator.onLine) return { ...local, source: 'local' };

  const exercise = EXERCISE_INDEX[exerciseId];
  const lastSession = S.lastSessionWith(exerciseId);
  const history = lastSession ? lastSession.sets.filter(s => s.type === 'working').map(s => ({
    weightKg: s.weightKg, reps: s.reps, rpe: s.rpe, date: s.createdAt,
  })) : [];

  const prompt = `What should I do next for "${exercise.name}"? Target ${slot.sets}×${slot.repLow}–${slot.repHigh}.
Last working sets:
${JSON.stringify(history)}

Return ONLY a JSON object (no other text) of shape: {"suggestedWeightKg": number|null, "reps": number, "sets": number, "rpeCap": number, "note": "short coaching line"}.`;

  try {
    const text = await callProvider(S.get().settings, [{ role: 'user', content: prompt }], { systemOverride: buildSystemPrompt(), maxTokens: 300 });
    const parsed = parseJsonLoose(text);
    if (parsed && typeof parsed === 'object' && (parsed.suggestedWeightKg != null || parsed.weightKg != null)) {
      return {
        weightKg: parsed.suggestedWeightKg ?? parsed.weightKg ?? local.weightKg,
        reps: parsed.reps ?? local.reps,
        sets: parsed.sets ?? local.sets,
        rpeCap: parsed.rpeCap ?? local.rpeCap,
        note: parsed.note || local.note,
        source: 'ai',
      };
    }
    return { ...local, source: 'local-fallback', aiText: text };
  } catch (e) {
    console.warn('AI suggest failed, using local:', /** @type {any} */ (e)?.message);
    return { ...local, source: 'local-fallback' };
  }
}

// Pre-session readiness check-in summarized into a session-scaling advice block.
export async function readinessAdvise(checkin) {
  const score = (() => {
    const sleep = checkin.sleep ?? 3, soreness = checkin.soreness ?? 3, energy = checkin.energy ?? 3;
    return (sleep - 1) * 12.5 + (energy - 1) * 12.5 - (soreness - 1) * 12.5 + 50;
  })();
  const local = readinessAdvice(Math.max(0, Math.min(100, Math.round(score))), checkin.pain);
  if (!isConfigured() || !navigator.onLine) return { ...local, source: 'local' };
  try {
    const text = await callProvider(S.get().settings, [{
      role: 'user',
      content: `Pre-session check-in: ${JSON.stringify(checkin)}. In 2 sentences, advise: train as planned, modify, or skip. Avoid pushing through sharp pain.`,
    }], { systemOverride: buildSystemPrompt(), maxTokens: 200 });
    return { ...local, text, source: 'ai' };
  } catch {
    return { ...local, source: 'local' };
  }
}

export async function weeklyReviewAsk() {
  const review = weeklyReview();
  const plateaus = detectPlateaus();
  if (!isConfigured() || !navigator.onLine) {
    return { text: localWeekly(review, plateaus), offline: true };
  }
  try {
    const text = await callProvider(S.get().settings, [{
      role: 'user',
      content: `Weekly review. Stats: ${JSON.stringify(review)}. Plateaus: ${JSON.stringify(plateaus)}. Give a short, friendly summary + 2–3 concrete suggestions for next week.`,
    }], { systemOverride: buildSystemPrompt(), maxTokens: 400 });
    return { text, offline: false };
  } catch (e) {
    return { text: localWeekly(review, plateaus), offline: true };
  }
}

// Sunday strategy: combine review + plateaus + readiness + joint warnings + diet adherence
// into a concrete next-week plan.
export async function weeklyStrategy() {
  const review = weeklyReview();
  const plateaus = detectPlateaus();
  if (!isConfigured() || !navigator.onLine) {
    return { text: localWeekly(review, plateaus) + '\n\n(Connect AI for a tailored plan.)', offline: true };
  }
  try {
    const s = S.get();
    const ctx = {
      stats: review,
      plateaus,
      readinessLast7: s.dailyLogs.slice(0, 7).map(d => ({ date: d.date.slice(0, 10), sleepH: d.sleepHours, energy: d.energy, soreness: d.soreness })),
      currentMeso: s.mesoConfig,
      goals: s.goals,
      jointPain: s.painLog.filter(p => p.status !== 'resolved').slice(0, 5),
    };
    const text = await callProvider(s.settings, [{
      role: 'user',
      content: `It's Sunday — weekly strategy session. Review this lifter's data and propose specifics for next week.

Data: ${JSON.stringify(ctx)}

Output 4 short paragraphs (no JSON, no bullets):
1) Honest assessment of last week (volume, adherence, readiness pattern).
2) 2-3 concrete adjustments for next week (e.g., "add 1 set to lat pulldown", "drop running tempo Thursday").
3) One thing to watch for / focus on this week.
4) A motivating one-liner.

Be concise, direct, and specific. No fluff.`,
    }], { systemOverride: buildSystemPrompt(), maxTokens: 600 });
    const strat = { generatedAt: new Date().toISOString(), weekStart: new Date().toISOString().slice(0, 10), text };
    S.setWeeklyStrategy(strat);
    return { text, offline: false };
  } catch (e) {
    return { text: localWeekly(review, plateaus) + `\n\n(AI unavailable: ${/** @type {any} */ (e)?.message})`, offline: true };
  }
}

function localWeekly(review, plateaus) {
  const muscles = Object.entries(review.volByMuscle).sort((a, b) => b[1] - a[1]);
  const lines = [
    `Week summary: ${review.sessions} sessions, ${review.sets} working sets, ${(review.totalDistanceMeters/1000).toFixed(1)} km of running.`,
  ];
  if (muscles.length) lines.push(`Top volume: ${muscles.slice(0, 3).map(([m, v]) => `${m} (${Math.round(v)}kg×reps)`).join(', ')}.`);
  if (plateaus.length) lines.push(`Plateau watch: ${plateaus.map(p => p.exerciseId).join(', ')} — try a variation or add a set next week.`);
  lines.push(`Next week: keep effort honest, log everything, and protect leg days from hard runs.`);
  return lines.join('\n');
}

// --- Context builder --------------------------------------------------------

function buildContext({ includeHistoryWeeks = 4 } = {}) {
  const s = S.get();
  const since = Date.now() - includeHistoryWeeks * 7 * 86400000;
  const sessions = s.sessions.filter(x => new Date(x.date).getTime() >= since);
  const sessionIds = new Set(sessions.map(x => x.id));
  const sets = s.sets.filter(x => sessionIds.has(x.sessionId)).map(x => ({
    sessionId: x.sessionId, exerciseId: x.exerciseId, weightKg: x.weightKg, reps: x.reps, rpe: x.rpe, type: x.type, date: x.createdAt,
  }));
  const ownedEquipment = Object.entries(s.equipment || {}).filter(([, v]) => v).map(([k]) => k);
  return {
    today: new Date().toISOString().slice(0, 10),
    units: s.settings.units,
    trainingMode: s.trainingMode,                       // 'gym' | 'home'
    homeEquipment: s.trainingMode === 'home' ? ['bodyweight', 'chair', ...ownedEquipment] : null,
    homeLadderPositions: s.trainingMode === 'home' ? s.homeLadderPos : null,
    weekType: s.schedule.currentWeekType,
    autoAlternate: s.settings.autoAlternateWeeks,
    deloadEvery: s.settings.deloadEvery,
    user: s.user,
    recentSessions: sessions.map(x => ({ id: x.id, date: x.date, dayLabel: x.dayLabel, status: x.status })),
    recentSets: sets.slice(-200),
    recentRuns: s.runs.slice(0, 10).map(r => ({ date: r.date, distanceMeters: r.distanceMeters, durationSeconds: r.durationSeconds })),
    bodyWeightKg: s.body[0]?.weightKg,
  };
}

// --- Provider adapters ------------------------------------------------------

// Exported so diet.js can reuse the same multi-provider plumbing.
export { callProvider };

// In-flight requests are tracked so a screen change can cancel them.
const inflight = new Map();
export function cancelAllAI() {
  for (const c of inflight.values()) { try { c.abort(); } catch {} }
  inflight.clear();
}

// Fetch wrapper with timeout + retry + abort.
async function fetchWithRetry(url, options, { timeout = 30000, retries = 1, tag = 'ai' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const tagKey = `${tag}-${Date.now()}-${Math.random()}`;
    inflight.set(tagKey, ctl);
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: ctl.signal });
      clearTimeout(timer);
      inflight.delete(tagKey);
      if (res.status >= 500 && attempt < retries) {
        // Retry on server error
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      inflight.delete(tagKey);
      if (/** @type {any} */ (e)?.name === 'AbortError' && attempt < retries) {
        // Timeout — retry once
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      lastErr = e;
      if (attempt >= retries) throw e;
    }
  }
  throw lastErr || new Error('AI request failed');
}

async function callProvider(settings, messages, opts = {}) {
  const sysPrompt = opts.systemOverride || buildSystemPrompt();
  const maxTokens = opts.maxTokens || 800;
  if (settings.aiProvider === 'openai')  return await callOpenAI(settings, sysPrompt, messages, maxTokens);
  if (settings.aiProvider === 'gemini')  return await callGemini(settings, sysPrompt, messages, maxTokens);
  if (settings.aiProvider === 'groq')    return await callGroq(settings, sysPrompt, messages, maxTokens);
  return await callAnthropic(settings, sysPrompt, messages, maxTokens);
}

async function callAnthropic(settings, system, messages, maxTokens) {
  const model = settings.aiModel || 'claude-opus-4-7';
  // Anthropic supports direct browser access with this header set; the user is using their own key on their own device.
  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.content?.map(c => c.text || '').join('').trim();
  if (!text) throw new Error('Empty response from Anthropic');
  return text;
}

async function callOpenAI(settings, system, messages, maxTokens) {
  const model = settings.aiModel || 'gpt-4o-mini';
  const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from OpenAI');
  return text;
}

// Google Gemini — FREE tier, generous limits, perfect for personal coaching.
// Get a key: https://aistudio.google.com/app/apikey
async function callGemini(settings, system, messages, maxTokens) {
  const model = settings.aiModel || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
  // Gemini wants role: "user" | "model" (not "assistant"); content is in "parts".
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

// Groq — also free, very fast, runs open-source models (Llama, etc.)
// Get a key: https://console.groq.com/keys
// Uses OpenAI-compatible API.
async function callGroq(settings, system, messages, maxTokens) {
  const model = settings.aiModel || 'llama-3.3-70b-versatile';
  const res = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`Groq ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from Groq');
  return text;
}
