import { el, toast, haptic, fmtDate, dayKey } from '../util.js';
import * as S from '../state.js';
import * as Diet from '../diet.js';
import { confirmAction, deleteWithUndo } from '../ui.js';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function render(view, router) {
  const s = S.get();
  const menu = S.activeWeeklyMenu();
  const today = new Date();
  const todayName = DAY_NAMES[today.getDay()];
  const todaysPlan = S.dailyDietPlanFor(today);

  view.replaceChildren(el('div', {}, [
    el('div', { class: 'h-row' }, [
      el('h1', {}, 'Diet'),
      menu ? el('button', { class: 'btn sm ghost', onclick: () => openUpload(router) }, 'Re-upload') : null,
    ]),

    // ---------- Today's plan ----------
    el('div', { class: 'hero' }, [
      el('div', { class: 'eyebrow' }, [`Today — ${todayName}`]),
      todaysPlan
        ? renderPlan(todaysPlan)
        : (menu
          ? el('div', {}, [
              el('p', { class: 'muted' }, 'No plan generated yet.'),
              el('button', { class: 'btn primary lg', onclick: () => generateToday(router) }, 'Generate today\'s plan'),
            ])
          : el('div', {}, [
              el('p', { class: 'muted' }, 'Upload your weekly mess menu to start.'),
              el('button', { class: 'btn primary lg', onclick: () => openUpload(router) }, 'Upload weekly menu'),
            ])
        ),
    ]),

    // ---------- Week peek ----------
    menu ? el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['This week']),
      el('p', { class: 'faint' }, `Uploaded ${fmtDate(menu.uploadedAt)}${menu.weekStart ? ' · ' + menu.weekStart + (menu.weekEnd ? ' → ' + menu.weekEnd : '') : ''}`),
      el('div', { class: 'list' }, (menu.days || []).map(d => el('div', { class: 'list-item' }, [
        el('div', {}, [
          el('div', { style: { fontWeight: 600 } }, d.name),
          el('div', { class: 'faint' }, summarizeDay(d, s.dietPreferences)),
        ]),
        el('button', { class: 'btn sm', onclick: () => generateFor(d.name, router) }, 'Plan'),
      ]))),
    ]) : null,

    // ---------- Education: Understanding macros ----------
    el('details', { class: 'card' }, [
      el('summary', { style: { cursor: 'pointer', fontWeight: 600, listStyle: 'none' } }, [
        el('span', { class: 'eyebrow' }, ['Macros — what they are']),
        el('span', { class: 'faint', style: { marginLeft: '8px', fontWeight: 400 } }, '(tap to expand)'),
      ]),
      el('div', { style: { marginTop: '8px', lineHeight: 1.5 } }, [
        el('p', { style: { margin: '8px 0' } }, [
          el('strong', { style: { color: 'var(--accent)' } }, 'Protein (P) '),
          ' — your muscle\'s building block. Made of amino acids. For hypertrophy a 63 kg lifter needs about ',
          el('strong', {}, '100–125 g/day'),
          ', spread across 3–4 meals. Best sources: paneer, dal, curd, milk, soya chunks, eggs, chicken, fish.',
        ]),
        el('p', { style: { margin: '8px 0' } }, [
          el('strong', { style: { color: '#fbbf24' } }, 'Carbohydrates (C) '),
          ' — your fuel for training. Rice, chapati, oats, potato, fruit. Eat more on lift days, less on rest days. ',
          el('strong', {}, '~4 kcal per gram'), '.',
        ]),
        el('p', { style: { margin: '8px 0' } }, [
          el('strong', { style: { color: '#a78bfa' } }, 'Fat (F) '),
          ' — for hormones, joint health, vitamin absorption. Ghee, nuts, paneer, oils. ',
          el('strong', {}, '~9 kcal per gram'),
          ' — small amounts pack big calories. Aim ',
          el('strong', {}, '~0.8–1 g/kg/day'),
          ' (50–65 g for 63 kg).',
        ]),
        el('p', { style: { margin: '8px 0' } }, [
          el('strong', { style: { color: '#4ade80' } }, 'Fiber (Fib) '),
          ' — keeps digestion healthy and food filling. From vegetables, fruit, dal, oats. Aim ',
          el('strong', {}, '25–35 g/day'),
          '. Counts as part of total carbs.',
        ]),
        el('div', { class: 'card flat', style: { marginTop: '12px', padding: '10px' } }, [
          el('div', { class: 'eyebrow' }, ['For muscle growth at 63 kg']),
          el('p', { style: { margin: '4px 0 0', fontSize: '14px' } },
            'Target ~2,400–2,700 kcal/day (your maintenance plus a small surplus). Hit your protein number first, then build calories around it with carbs and fat.'),
        ]),
        el('p', { class: 'faint', style: { margin: '8px 0 0', fontSize: '12px' } },
          'Educational guidelines, not medical advice. For specific health conditions, consult a registered dietitian.'),
      ]),
    ]),

    // ---------- Preferences ----------
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Preferences']),
      el('div', { class: 'field' }, [
        el('label', {}, 'Dietary type'),
        el('select', { onchange: (e) => { S.setDietPreferences({ dietary: e.target.value }); toast('Saved'); } }, [
          el('option', { value: 'vegetarian', selected: s.dietPreferences.dietary === 'vegetarian' }, 'Vegetarian'),
          el('option', { value: 'eggetarian', selected: s.dietPreferences.dietary === 'eggetarian' }, 'Eggetarian'),
          el('option', { value: 'vegan',      selected: s.dietPreferences.dietary === 'vegan'      }, 'Vegan'),
          el('option', { value: 'non-veg',    selected: s.dietPreferences.dietary === 'non-veg'    }, 'Non-vegetarian'),
        ]),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Protein target (g per kg bodyweight per day)'),
        el('input', { type: 'number', step: '0.1', min: '1.2', max: '2.5', value: String(s.dietPreferences.proteinPerKg),
          oninput: (e) => S.setDietPreferences({ proteinPerKg: parseFloat(e.target.value) || 1.8 }) }),
        el('p', { class: 'faint' }, 'For hypertrophy: 1.6–2.0 g/kg is the sweet spot. 1.8 is a solid default.'),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Always-available supplements (comma-separated)'),
        el('input', { type: 'text', value: (s.dietPreferences.supplementsAvailable || []).join(', '),
          placeholder: 'milk, curd, paneer, peanut butter, soya chunks',
          oninput: (e) => S.setDietPreferences({ supplementsAvailable: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }) }),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Allergies / dislikes (free text)'),
        el('input', { type: 'text', value: s.dietPreferences.allergies || '',
          placeholder: 'no mushrooms, lactose-light…',
          oninput: (e) => S.setDietPreferences({ allergies: e.target.value }) }),
      ]),
    ]),

    // ---- Meal timing nudge ----
    (() => {
      const lastMeal = s.mealLogs[0];
      if (!lastMeal) return null;
      const hoursSince = (Date.now() - new Date(lastMeal.date).getTime()) / 3600000;
      if (hoursSince < 3.5) return null;
      const isLate = hoursSince > 5;
      return el('div', { class: 'card', style: { borderColor: isLate ? 'var(--warn)' : 'var(--accent)' } }, [
        el('strong', { style: { color: isLate ? 'var(--warn)' : 'var(--accent)' } }, isLate ? '⏰ Long gap since last meal' : '🍽 Meal timing nudge'),
        el('p', { class: 'muted', style: { margin: '6px 0 0' } }, `${hoursSince.toFixed(1)}h since your last logged meal. For hypertrophy, aim for protein every 3-4h.`),
      ]);
    })(),

    // ---- Cheat-day budget ----
    el('details', { class: 'card' }, [
      el('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, [
        el('span', { class: 'eyebrow' }, ['Weekly calorie budget']),
        el('span', { class: 'faint', style: { marginLeft: '8px', fontWeight: 400 } }, '(optional, tap to expand)'),
      ]),
      renderCheatBudget(s),
    ]),

    // ---- Meal photo logger ----
    el('div', { class: 'card' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', { class: 'eyebrow' }, ['Log a meal (photo)']),
        el('button', { class: 'btn sm', onclick: () => router.openSheet('mealPhoto') }, 'Snap'),
      ]),
      (s.mealLogs || []).length
        ? el('div', { class: 'list', style: { marginTop: '6px' } }, s.mealLogs.slice(0, 5).map(m => el('div', { class: 'list-item' }, [
            el('div', {}, [
              el('div', { style: { fontWeight: 600 } }, (m.items || []).slice(0, 3).map(i => i.item).join(', ') || 'Meal'),
              el('div', { class: 'faint' }, `${fmtDate(m.date)} · ~${m.totals?.proteinG || '?'}g · ~${m.totals?.kcal || '?'}kcal`),
            ]),
            el('button', { class: 'btn sm ghost danger', onclick: () => {
              const snap = { ...m };
              deleteWithUndo('meal', () => { S.deleteMeal(m.id); router.refresh(); }, () => { S.logMeal(snap); router.refresh(); });
            } }, '✕'),
          ])))
        : el('p', { class: 'faint', style: { margin: '4px 0 0' } }, 'Snap your plate, AI estimates protein/kcal.'),
    ]),

    // ---- Shopping list ----
    el('div', { class: 'card' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', { class: 'eyebrow' }, ['Shopping list']),
        el('button', { class: 'btn sm', onclick: () => buildShopping(router) }, s.shoppingList ? 'Rebuild' : 'Generate'),
      ]),
      s.shoppingList
        ? el('div', { style: { marginTop: '6px' } }, [
            el('p', { class: 'faint', style: { margin: 0 } }, `Generated ${fmtDate(s.shoppingList.generatedAt)}`),
            el('ul', { style: { paddingLeft: '20px', margin: '6px 0' } }, (s.shoppingList.items || []).map(it =>
              el('li', {}, `${it.name} · ${it.qty}${it.category ? ' · ' + it.category : ''}`))),
            s.shoppingList.note ? el('p', { class: 'faint' }, s.shoppingList.note) : null,
          ])
        : el('p', { class: 'faint', style: { margin: '4px 0 0' } }, 'Aggregate supplements + extras from your generated daily plans into a tidy shopping list.'),
    ]),

    menu ? el('div', { class: 'card flat' }, [
      el('button', { class: 'btn ghost danger', onclick: async () => {
        if (!await confirmAction({ title: 'Remove this week\'s menu?', confirmLabel: 'Remove' })) return;
        S.deleteWeeklyMenu(menu.id);
        toast('Menu removed');
        router.refresh();
      } }, 'Remove this menu'),
    ]) : null,
  ]));

  async function buildShopping(router) {
    haptic('light');
    toast('Building list…');
    try {
      const list = await Diet.buildShoppingList();
      S.setShoppingList(list);
      toast('Shopping list ready', 'success');
      router.refresh();
    } catch (e) {
      toast(`Failed: ${/** @type {any} */ (e)?.message}`, 'error');
    }
  }
}

// ---- Meal photo sheet ----
export function renderMealPhotoSheet(sheetBody, ctx, router) {
  let preview = null;
  let parsed = null;
  redraw();
  function redraw() {
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Log a meal'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, 'Snap your plate. AI estimates protein + calories.'),
      el('div', { class: 'field' }, [
        el('label', {}, 'Photo'),
        el('input', { type: 'file', accept: 'image/*', onchange: handle }),
      ]),
      preview ? el('img', { src: preview, style: { maxWidth: '100%', borderRadius: '12px', maxHeight: '220px', objectFit: 'contain' } }) : null,
      parsed ? renderParsed() : null,
    );
  }
  function renderParsed() {
    return el('div', { class: 'card flat', style: { marginTop: '12px' } }, [
      el('p', { class: 'faint' }, `Confidence: ${parsed.confidence || 'med'}${parsed.note ? ' · ' + parsed.note : ''}`),
      el('div', { class: 'list' }, (parsed.items || []).map(it => el('div', { class: 'list-item' }, [
        el('div', {}, [el('div', { style: { fontWeight: 600 } }, it.item), el('div', { class: 'faint' }, it.portion || '')]),
        el('span', { class: 'meta' }, `${it.proteinG ?? '?'}g · ${it.kcal ?? '?'}kcal`),
      ]))),
      parsed.totals ? el('p', { style: { marginTop: '6px' } }, `Total: ${parsed.totals.proteinG ?? '?'}g protein · ${parsed.totals.kcal ?? '?'} kcal`) : null,
      el('button', { class: 'btn primary block lg', onclick: save }, 'Save meal'),
    ]);
  }
  function handle(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      preview = reader.result; redraw();
      toast('Analyzing photo…');
      try {
        parsed = await Diet.logMealFromImage(reader.result);
        toast('Parsed', 'success');
        redraw();
      } catch (e) { toast(`Failed: ${/** @type {any} */ (e)?.message}`, 'error'); }
    };
    reader.readAsDataURL(f);
  }
  function save() {
    S.logMeal({ items: parsed.items, totals: parsed.totals });
    toast('Meal saved', 'success');
    router.closeSheet(); router.refresh();
  }
}

function renderPlan(plan) {
  return el('div', {}, [
    plan.advice ? el('p', { class: 'muted', style: { marginTop: '4px' } }, plan.advice) : null,
    plan.totals ? el('div', { style: { marginTop: '8px' } }, [
      el('div', { class: 'row-flex', style: { gap: '6px', flexWrap: 'wrap' } }, [
        el('span', { class: 'pill accent' }, `~${plan.totals.proteinG || 0}g protein`),
        el('span', { class: 'pill' }, `~${plan.totals.carbsG || 0}g carbs`),
        el('span', { class: 'pill' }, `~${plan.totals.fatG || 0}g fat`),
        plan.totals.fiberG ? el('span', { class: 'pill' }, `~${plan.totals.fiberG}g fiber`) : null,
        el('span', { class: 'pill' }, `~${plan.totals.kcal || 0} kcal`),
      ]),
      plan.targetProtein ? el('p', { class: 'faint', style: { margin: '6px 0 0' } }, `Protein target: ${plan.targetProtein.low}–${plan.targetProtein.high}g/day`) : null,
    ]) : null,
    el('div', { class: 'list', style: { marginTop: '8px' } }, (plan.meals || []).map(meal => el('div', { style: { padding: '10px 0', borderTop: '1px solid var(--line)' } }, [
      el('div', { class: 'eyebrow', style: { color: 'var(--accent-2)' } }, [meal.name]),
      el('div', { style: { marginTop: '4px' } }, (meal.items || []).map(it => renderMealItem(it))),
      meal.note ? el('p', { class: 'faint', style: { margin: '6px 0 0' } }, meal.note) : null,
    ]))),
    (plan.supplements || []).length ? el('div', { style: { marginTop: '12px' } }, [
      el('div', { class: 'eyebrow', style: { color: 'var(--accent-2)' } }, ['Add at home']),
      el('div', { class: 'list' }, plan.supplements.map(sup => renderSupplement(sup))),
    ]) : null,
  ]);
}

function renderMealItem(it) {
  return el('div', { style: { padding: '8px 0', borderBottom: '1px dashed var(--line)' } }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' } }, [
      el('div', { style: { flex: 1, minWidth: 0 } }, [
        el('div', { style: { fontWeight: 600 } }, it.item),
        el('div', { class: 'faint', style: { fontSize: '12px' } }, [
          it.portion || '',
          it.why ? el('span', { style: { color: 'var(--accent-2)', marginLeft: '6px', fontStyle: 'italic' } }, `· ${it.why}`) : null,
        ]),
      ]),
      el('div', { style: { fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontSize: '12px', minWidth: '60px' } }, [
        el('div', { style: { fontWeight: 600, color: 'var(--accent)' } }, `${it.kcal ?? '–'} kcal`),
      ]),
    ]),
    el('div', { class: 'row-flex', style: { gap: '4px', marginTop: '4px', fontSize: '11px', flexWrap: 'wrap' } }, [
      macroChip('P', it.proteinG, 'var(--accent)'),
      macroChip('C', it.carbsG, '#fbbf24'),
      macroChip('F', it.fatG, '#a78bfa'),
      it.fiberG != null ? macroChip('Fib', it.fiberG, '#4ade80') : null,
    ]),
  ]);
}

function renderSupplement(sup) {
  return el('div', { style: { padding: '8px 0', borderBottom: '1px dashed var(--line)' } }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } }, [
      el('div', { style: { flex: 1 } }, [
        el('div', { style: { fontWeight: 600 } }, sup.item),
        el('div', { class: 'faint', style: { fontSize: '12px' } }, sup.when || ''),
      ]),
      el('div', { style: { fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontSize: '12px' } }, `${sup.kcal ?? '–'} kcal`),
    ]),
    el('div', { class: 'row-flex', style: { gap: '4px', marginTop: '4px', fontSize: '11px', flexWrap: 'wrap' } }, [
      macroChip('P', sup.proteinG, 'var(--accent)'),
      sup.carbsG != null ? macroChip('C', sup.carbsG, '#fbbf24') : null,
      sup.fatG != null ? macroChip('F', sup.fatG, '#a78bfa') : null,
    ]),
  ]);
}

function renderCheatBudget(s) {
  const weekly = s.cheatBudget?.weeklyTotalKcal;
  const days = s.cheatBudget?.days || {};
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return el('div', { style: { marginTop: '8px' } }, [
    el('div', { class: 'field' }, [
      el('label', {}, 'Weekly total calorie budget'),
      el('input', { type: 'number', placeholder: '17,500', value: weekly || '', oninput: e => {
        const v = parseInt(e.target.value, 10);
        S.setCheatBudget({ weeklyTotalKcal: Number.isFinite(v) && v > 0 ? v : null });
      }}),
      el('p', { class: 'faint' }, 'Total over 7 days. Eat less on rest days to "save" calories for a higher day.'),
    ]),
    el('div', { style: { marginTop: '8px' } }, [
      el('div', { class: 'eyebrow' }, ['Per-day allocation']),
      el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginTop: '4px' } },
        dayNames.map((d, i) => el('div', { class: 'field', style: { minWidth: 0 } }, [
          el('label', { style: { fontSize: '11px', textAlign: 'center' } }, d),
          el('input', { type: 'number', placeholder: '—', style: { fontSize: '13px', padding: '6px 4px', textAlign: 'center' }, value: days[d] || '', oninput: e => {
            const v = parseInt(e.target.value, 10);
            const newDays = { ...days };
            if (Number.isFinite(v) && v > 0) newDays[d] = v;
            else delete newDays[d];
            S.setCheatBudget({ days: newDays });
          }}),
        ]))),
      weekly ? el('p', { class: 'faint' }, `Allocated: ${Object.values(days).reduce((a, b) => a + b, 0)} / ${weekly} kcal`) : null,
    ]),
  ]);
}

function macroChip(label, value, color) {
  if (value == null) return null;
  return el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-3)', border: `1px solid ${color}`, color, fontWeight: 600 } },
    `${label} ${value}g`);
}

function summarizeDay(day, prefs) {
  const filt = (arr = []) => arr.filter(x => prefs.dietary !== 'vegetarian' || x.veg !== false);
  const top = [...filt(day.breakfast).slice(0, 2), ...filt(day.lunch).slice(0, 2), ...filt(day.dinner).slice(0, 2)];
  if (!top.length) return 'No veg items found';
  return top.map(x => x.item).slice(0, 5).join(' · ');
}

// ---------------- Upload + parse flow ----------------

function openUpload(router) {
  router.openSheet('uploadMenu');
}

export function renderUploadSheet(sheetBody, ctx, router) {
  let mode = 'image'; // 'image' or 'text'
  redraw();

  function redraw() {
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Upload weekly menu'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, 'AI will parse it. You only do this once per week.'),

      el('div', { class: 'row-flex', style: { margin: '8px 0' } }, [
        el('button', { class: `btn sm ${mode === 'image' ? 'primary' : ''}`, onclick: () => { mode = 'image'; redraw(); } }, 'Photo / Image'),
        el('button', { class: `btn sm ${mode === 'text' ? 'primary' : ''}`, onclick: () => { mode = 'text'; redraw(); } }, 'Paste text'),
      ]),

      mode === 'image' ? renderImagePane() : renderTextPane(),

      el('p', { class: 'faint', style: { marginTop: '12px' } }, 'Image needs Gemini, OpenAI, or Anthropic (your current provider must support vision). Paste text works with any provider.'),
    );
  }

  function renderImagePane() {
    return el('div', {}, [
      el('div', { class: 'field' }, [
        el('label', {}, 'Photo of the menu'),
        el('input', { type: 'file', accept: 'image/*', onchange: handleImage, id: 'menuImg' }),
      ]),
      el('div', { id: 'imgPreview' }),
    ]);
  }
  function renderTextPane() {
    return el('div', {}, [
      el('div', { class: 'field' }, [
        el('label', {}, 'Paste the menu text'),
        el('textarea', { id: 'menuText', rows: 10, placeholder: 'Monday — Breakfast: Cornflakes, Eggs, Toast…\nLunch: Tomato Rice, Dal Tadka, Chicken Masala…\n…' }),
      ]),
      el('button', { class: 'btn primary block lg', onclick: handleText }, 'Parse menu'),
    ]);
  }

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    haptic('light');
    const reader = new FileReader();
    reader.onload = async () => {
      const preview = /** @type {HTMLElement} */ (document.getElementById('imgPreview'));
      preview.replaceChildren(
        el('img', { src: reader.result, style: { maxWidth: '100%', borderRadius: '12px', margin: '8px 0', maxHeight: '220px', objectFit: 'contain' } }),
        el('div', { id: 'parseStatus', class: 'muted' }, 'Parsing menu…'),
      );
      try {
        const parsed = await Diet.parseMenuImage(reader.result);
        S.addWeeklyMenu({ source: 'image', ...parsed });
        toast('Menu saved ✓', 'success');
        router.closeSheet();
        router.refresh();
      } catch (err) {
        /** @type {HTMLElement} */ (document.getElementById('parseStatus')).textContent = `Failed: ${/** @type {any} */ (err)?.message}`;
        toast('Parse failed — see message', 'error');
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleText() {
    const text = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('menuText'))?.value?.trim();
    if (!text) { toast('Paste the menu text first', 'error'); return; }
    haptic('light');
    toast('Parsing…');
    try {
      const parsed = await Diet.parseMenuText(text);
      S.addWeeklyMenu({ source: 'text', ...parsed });
      toast('Menu saved ✓', 'success');
      router.closeSheet();
      router.refresh();
    } catch (err) {
      toast(`Parse failed: ${/** @type {any} */ (err)?.message}`, 'error');
    }
  }
}

// ---------------- Generate plan helpers ----------------

async function generateToday(router) {
  const today = new Date();
  const name = DAY_NAMES[today.getDay()];
  await generateFor(name, router);
}

async function generateFor(dayName, router) {
  const menu = S.activeWeeklyMenu();
  if (!menu) { toast('Upload a menu first', 'error'); return; }
  haptic('light');
  toast(`Building ${dayName} plan…`);
  try {
    const plan = await Diet.planDay(menu, dayName);
    S.saveDailyDietPlan(plan);
    toast(`${dayName} plan ready ✓`, 'success');
    router.refresh();
  } catch (err) {
    toast(`Failed: ${/** @type {any} */ (err)?.message}`, 'error');
  }
}
