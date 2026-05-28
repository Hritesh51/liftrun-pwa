// DietService — parses a weekly mess menu from image or text, then builds a daily eating plan.
// Vision is required only for image upload. Text path works with any provider (incl. Groq/Llama).
import * as S from './state.js';
import { parseJsonLoose, dayKey } from './util.js';
import { callProvider } from './coach.js';

const VISION_PROVIDERS = ['gemini', 'openai', 'anthropic'];

const PARSE_PROMPT = `You are reading a weekly mess/canteen menu. Return STRICT JSON ONLY (no prose, no markdown fences).

Shape:
{
  "weekStart": "YYYY-MM-DD" (best guess from the menu header, e.g. "18 MAY 2026"),
  "weekEnd": "YYYY-MM-DD",
  "days": [
    {
      "name": "Monday",
      "date": "YYYY-MM-DD",
      "morningTea": [{ "item": "Ginger Tea", "veg": true }],
      "breakfast": [{ "item": "Cornflakes", "veg": true }, ...],
      "lunch":     [{ "item": "Tomato Rice", "veg": true }, ...],
      "tea":       [{ "item": "Samosa", "veg": true }, ...],
      "dinner":    [...],
      "dessert":   "Moong Dal Halwa" (or null)
    },
    ... (one per day)
  ]
}

Rules:
- Mark veg:false for items containing chicken, fish, mutton, beef, prawn, sausage, egg.
- (V) after a name means a vegetarian variant — mark as veg:true.
- Include ALL items listed for each meal, not just one.
- If a meal slot is empty, use [].
- Use ISO YYYY-MM-DD for dates; infer from the menu header if shown.`;

// --- Parse menu from image ----------------------------------------------

export async function parseMenuImage(imageDataURL) {
  const settings = S.get().settings;
  if (!VISION_PROVIDERS.includes(settings.aiProvider)) {
    throw new Error(`Image parsing needs Gemini, OpenAI, or Anthropic (your current provider doesn't support vision). Either switch in Settings, or paste the menu as text instead.`);
  }
  const compressed = await compressImage(imageDataURL, { maxSide: 1600, quality: 0.85 });
  const base64 = compressed.replace(/^data:image\/[a-z]+;base64,/, '');

  let raw;
  if (settings.aiProvider === 'gemini')    raw = await callGeminiVision(settings, PARSE_PROMPT, base64);
  else if (settings.aiProvider === 'openai')   raw = await callOpenAIVision(settings, PARSE_PROMPT, compressed);
  else                                        raw = await callAnthropicVision(settings, PARSE_PROMPT, base64);

  const parsed = parseJsonLoose(raw);
  if (!parsed || !parsed.days) throw new Error('Could not parse menu — try a clearer photo, or paste as text.');
  return parsed;
}

// --- Parse menu from pasted text ---------------------------------------

export async function parseMenuText(text) {
  const settings = S.get().settings;
  const messages = [{ role: 'user', content: `${PARSE_PROMPT}\n\nMenu text:\n${text}` }];
  const raw = await callProvider(settings, messages, { systemOverride: 'You convert menus into structured JSON. Respond with JSON only.', maxTokens: 4000 });
  const parsed = parseJsonLoose(raw);
  if (!parsed || !parsed.days) throw new Error('Could not parse the text — make sure days and meals are clearly labeled.');
  return parsed;
}

// --- Build today's eating plan from a parsed menu ----------------------

export async function planDay(menu, dayName, opts = {}) {
  const s = S.get();
  const prefs = s.dietPreferences;
  const bodyKg = s.body[0]?.weightKg || s.user.startingWeightKg || 63;
  const targetProteinLow  = Math.round(bodyKg * 1.6);
  const targetProteinHigh = Math.round(bodyKg * (prefs.proteinPerKg + 0.2));

  // Find the day record
  let day = menu.days.find(d => d.name?.toLowerCase() === dayName?.toLowerCase());
  if (!day) day = menu.days[0];
  if (!day) throw new Error('No day found in menu');

  // Filter to user's dietary type (vegetarian by default)
  const filterMeal = (arr = []) => arr.filter(it => {
    if (prefs.dietary === 'non-veg') return true;
    if (prefs.dietary === 'eggetarian') return it.veg !== false; // keep eggs by name match (LLM may have flagged); we trust veg flag mostly
    return it.veg !== false; // vegetarian + vegan
  });
  const filteredDay = {
    name: day.name,
    date: day.date,
    breakfast: filterMeal(day.breakfast),
    lunch: filterMeal(day.lunch),
    tea: filterMeal(day.tea),
    dinner: filterMeal(day.dinner),
    morningTea: filterMeal(day.morningTea),
    dessert: day.dessert || null,
  };

  const prompt = `Build today's eating plan for a beginner hypertrophy lifter eating from a mess menu.

User profile:
- Weight: ${bodyKg} kg
- Dietary: ${prefs.dietary}
- Goal: muscle growth, mild surplus
- Daily protein target: ${targetProteinLow}–${targetProteinHigh} g
- Always-available supplements at home: ${prefs.supplementsAvailable.join(', ') || 'milk, curd, paneer'}
- Allergies / dislikes: ${prefs.allergies || 'none'}

Today's menu (already filtered to user's diet, but YOU MUST still pick wisely):
${JSON.stringify(filteredDay)}

Return STRICT JSON ONLY:
{
  "meals": [
    {
      "name": "Breakfast",
      "items": [
        { "item": "Aloo Paratha", "portion": "2 medium", "proteinG": 9, "carbsG": 60, "fatG": 12, "fiberG": 4, "kcal": 380, "why": "starch base, mild protein" }
      ],
      "note": "1 short coaching line for this meal."
    },
    { "name": "Lunch",   "items": [...], "note": "..." },
    { "name": "Tea",     "items": [...], "note": "..." },
    { "name": "Dinner",  "items": [...], "note": "..." }
  ],
  "supplements": [
    { "item": "1 glass milk (250 ml)", "proteinG": 8, "carbsG": 12, "fatG": 4, "fiberG": 0, "kcal": 150, "when": "with breakfast" },
    { "item": "1 cup curd", "proteinG": 7, "carbsG": 6, "fatG": 4, "fiberG": 0, "kcal": 90, "when": "with lunch" }
  ],
  "totals": { "proteinG": 115, "carbsG": 320, "fatG": 70, "fiberG": 28, "kcal": 2450 },
  "advice": "1–2 sentence overall guidance — be friendly and direct."
}

Rules:
- For EVERY item include: proteinG, carbsG, fatG, fiberG, kcal, and a 3-6 word "why" tag explaining its role (e.g. "primary protein", "starch base", "veg + fiber").
- Pick 2–4 items per meal from what's listed. Prefer protein-dense (paneer, dal, curd, milk).
- Estimate macros conservatively (realistic Indian-portion values).
- Use supplements ONLY to close the protein gap toward target.
- If a meal has no good options, still include 1 item plus a supplement note.
- Mention dessert sparingly — once per day max, as a treat note.
- Be SAFE: no extreme restriction, no fasting prescriptions, no skipping meals.`;

  const messages = [{ role: 'user', content: prompt }];
  const raw = await callProvider(s.settings, messages, {
    systemOverride: 'You are a vegetarian-friendly nutrition assistant. Respond with strict JSON only. No prose, no markdown.',
    maxTokens: 2000,
  });
  const parsed = parseJsonLoose(raw);
  if (!parsed || !parsed.meals) throw new Error('Could not generate a plan — try again or check your AI provider.');
  parsed.date = new Date().toISOString();
  parsed.dayName = day.name;
  parsed.targetProtein = { low: targetProteinLow, high: targetProteinHigh };
  return parsed;
}

// --- Meal photo logging -------------------------------------------------

const MEAL_PARSE_PROMPT = `You are estimating the nutrition of food in a photo. Return STRICT JSON ONLY:
{
  "items": [
    { "item": "Aloo Paratha", "portion": "2 medium pieces (~150g)", "proteinG": 9, "carbsG": 60, "fatG": 12, "fiberG": 4, "kcal": 380 },
    { "item": "Curd", "portion": "1 cup (~200g)", "proteinG": 7, "carbsG": 8, "fatG": 5, "fiberG": 0, "kcal": 110 }
  ],
  "totals": { "proteinG": 16, "carbsG": 68, "fatG": 17, "fiberG": 4, "kcal": 490 },
  "confidence": "low" | "med" | "high",
  "note": "1-sentence sanity check or caveat."
}
Rules:
- For EVERY item include proteinG, carbsG, fatG, fiberG, kcal.
- Estimate REALISTIC Indian/mess portions.
- Be conservative on protein (don't inflate).
- If unsure about an item, set confidence: "low".`;

export async function logMealFromImage(imageDataURL) {
  const settings = S.get().settings;
  if (!VISION_PROVIDERS.includes(settings.aiProvider)) {
    throw new Error(`Image needs Gemini, OpenAI, or Anthropic. Or log the meal manually.`);
  }
  const compressed = await compressImage(imageDataURL, { maxSide: 1200, quality: 0.8 });
  const base64 = compressed.replace(/^data:image\/[a-z]+;base64,/, '');
  let raw;
  if (settings.aiProvider === 'gemini')    raw = await callGeminiVision(settings, MEAL_PARSE_PROMPT, base64);
  else if (settings.aiProvider === 'openai')   raw = await callOpenAIVision(settings, MEAL_PARSE_PROMPT, compressed);
  else                                        raw = await callAnthropicVision(settings, MEAL_PARSE_PROMPT, base64);
  const parsed = parseJsonLoose(raw);
  if (!parsed || !parsed.items) throw new Error('Could not parse meal photo');
  return parsed;
}

// --- Shopping list from a week's diet plans -------------------------------

export async function buildShoppingList() {
  const s = S.get();
  const plans = s.dailyDietPlans.slice(0, 7); // last 7 daily plans
  if (!plans.length) throw new Error('Generate a few daily plans first.');
  const supplements = new Set();
  const items = [];
  for (const p of plans) {
    for (const meal of p.meals || []) {
      for (const it of meal.items || []) items.push(it.item);
    }
    for (const sup of p.supplements || []) supplements.add(sup.item);
  }
  const prompt = `Build a concise weekly grocery list from these meal items (mess meals are already provided; only list things the user buys at home as supplements/snacks). Consolidate quantities sensibly.

Already-planned supplements: ${[...supplements].join('; ')}
Available staples: ${(s.dietPreferences.supplementsAvailable || []).join(', ')}

Return STRICT JSON ONLY:
{
  "items": [
    { "name": "Milk", "qty": "5 L for the week", "category": "dairy" },
    { "name": "Paneer", "qty": "500 g", "category": "dairy" }
  ],
  "note": "1-2 sentence shopping tip."
}`;
  const raw = await callProvider(s.settings, [{ role: 'user', content: prompt }], {
    systemOverride: 'You build short shopping lists from meal plans. Respond with JSON only.',
    maxTokens: 600,
  });
  const parsed = parseJsonLoose(raw);
  if (!parsed?.items) throw new Error('Could not build shopping list');
  return { generatedAt: new Date().toISOString(), ...parsed };
}

// --- Image compression -------------------------------------------------

async function compressImage(dataURL, { maxSide = 1600, quality = 0.85 } = {}) {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas 2d unavailable')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataURL;
  });
}

// --- Vision adapters ---------------------------------------------------

async function callGeminiVision(settings, prompt, base64) {
  const model = settings.aiModel || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: { maxOutputTokens: 8000, temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
}

async function callOpenAIVision(settings, prompt, dataURL) {
  const model = settings.aiModel || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataURL } },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

async function callAnthropicVision(settings, prompt, base64) {
  const model = settings.aiModel || 'claude-opus-4-7';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.content || []).map(c => c.text || '').join('').trim();
}
