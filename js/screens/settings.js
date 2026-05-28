import { el, toast, haptic, fmtDate } from '../util.js';
import * as S from '../state.js';
import * as Profiles from '../profiles.js';
import * as Backup from '../backup.js';
import * as Diag from '../diag.js';
import * as Sync from '../sync.js';
import { requestNotificationPermission } from '../timer.js';

const SUPABASE_SQL = `create table if not exists liftrun_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  name text,
  state jsonb not null,
  rev bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);
alter table liftrun_state enable row level security;
create policy "own rows only" on liftrun_state
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);`;
import { importHealthXML } from '../healthimport.js';
import { confirmAction } from '../ui.js';

export function render(view, router) {
  const s = S.get();
  const activeProfile = Profiles.getProfile(Profiles.activeId());
  view.replaceChildren(el('div', {}, [
    el('div', { class: 'h-row' }, [el('h1', {}, 'Settings')]),

    // Account / profiles
    el('div', { class: 'card' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', { class: 'eyebrow' }, ['Profile']),
        el('button', { class: 'btn sm', onclick: () => router.openSheet('profiles') }, 'Switch / manage'),
      ]),
      el('p', { style: { margin: '6px 0 0' } }, [
        'Signed in as ', el('strong', {}, activeProfile ? activeProfile.name : 'this device'), '.',
      ]),
      el('p', { class: 'faint', style: { margin: '4px 0 0' } }, 'Profiles are separate accounts on this device — each keeps its own workouts, settings and colour theme.'),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Appearance']),
      el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '8px' } },
        [{ id: 'dark', label: '🌙 Dark' }, { id: 'light', label: '☀ Light' }, { id: 'system', label: '⚙ System' }, { id: 'pink', label: '🌸 Pink' }].map(t =>
          el('button', { class: `btn ${s.settings.theme === t.id ? 'primary' : ''}`, onclick: () => set('theme', t.id) }, t.label))),
      el('div', { class: 'field', style: { marginTop: '12px' } }, [
        el('label', {}, 'Text size'),
        el('div', { class: 'row-flex' }, [
          ...[{ id: 'default', label: 'Default' }, { id: 'large', label: 'Large' }, { id: 'larger', label: 'Larger' }].map(t =>
            el('button', { class: `btn sm ${(s.settings.textSize || 'default') === t.id ? 'primary' : ''}`, style: { flex: 1 }, onclick: () => set('textSize', t.id) }, t.label)),
        ]),
      ]),
    ]),

    el('div', { class: 'card' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, [
        el('div', { class: 'eyebrow' }, ['Training location']),
        el('button', { class: 'btn sm', onclick: () => router.openSheet('equipment') }, s.trainingMode === 'home' ? '🏠 Home' : '🏋️ Gym'),
      ]),
      el('p', { class: 'faint', style: { margin: '6px 0 0' } }, s.trainingMode === 'home'
        ? 'Home mode — bodyweight/band/dumbbell workouts with difficulty-ladder progression.'
        : 'Gym mode — machines, barbells, cables. Tap to switch to home training.'),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Units']),
      el('div', { class: 'row-flex', style: { marginTop: '8px' } }, [
        el('button', { class: `btn ${s.settings.units === 'kg' ? 'primary' : ''}`, onclick: () => set('units', 'kg') }, 'kg / km'),
        el('button', { class: `btn ${s.settings.units === 'lb' ? 'primary' : ''}`, onclick: () => set('units', 'lb') }, 'lb / mi'),
      ]),
      el('p', { class: 'faint' }, 'Stored values stay in kg — only the display converts.'),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['AI Coach']),
      el('div', { class: 'field' }, [
        el('label', {}, 'Provider'),
        el('select', { onchange: (e) => set('aiProvider', e.target.value) }, [
          el('option', { value: 'gemini', selected: s.settings.aiProvider === 'gemini' }, 'Google Gemini (FREE)'),
          el('option', { value: 'groq', selected: s.settings.aiProvider === 'groq' }, 'Groq (FREE, fast)'),
          el('option', { value: 'anthropic', selected: s.settings.aiProvider === 'anthropic' }, 'Anthropic (Claude, paid)'),
          el('option', { value: 'openai', selected: s.settings.aiProvider === 'openai' }, 'OpenAI (paid)'),
        ]),
        el('p', { class: 'faint' }, [
          'Free: ',
          el('a', { href: 'https://aistudio.google.com/app/apikey', target: '_blank', rel: 'noopener' }, 'Gemini'),
          ' or ',
          el('a', { href: 'https://console.groq.com/keys', target: '_blank', rel: 'noopener' }, 'Groq'),
          '. Anthropic / OpenAI require a credit card.',
        ]),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'API Key'),
        el('input', { type: 'password', placeholder: keyPlaceholder(s.settings.aiProvider), value: s.settings.apiKey || '', oninput: (e) => set('apiKey', e.target.value) }),
        el('p', { class: 'faint' }, 'Stored locally on your phone. Used only when you send a message or ask for a suggestion.'),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Model'),
        el('input', { type: 'text', placeholder: modelPlaceholder(s.settings.aiProvider), value: s.settings.aiModel || '', oninput: (e) => set('aiModel', e.target.value) }),
        el('p', { class: 'faint' }, modelHint(s.settings.aiProvider)),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Coaching style'),
        el('select', { onchange: (e) => set('coachPersona', e.target.value) }, [
          el('option', { value: 'balanced',   selected: s.settings.coachPersona === 'balanced' },   'Balanced — calm, supportive, evidence-based'),
          el('option', { value: 'supportive', selected: s.settings.coachPersona === 'supportive' }, 'Supportive — warm, celebrates wins'),
          el('option', { value: 'strict',     selected: s.settings.coachPersona === 'strict' },     'Strict — direct, accountable, no fluff'),
          el('option', { value: 'hardcore',   selected: s.settings.coachPersona === 'hardcore' },   'Hardcore — old-school, pushes you mentally'),
        ]),
      ]),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Schedule']),
      el('div', { class: 'toggle' }, [
        el('div', { class: 'label' }, 'Auto-alternate Week A / B'),
        el('button', { class: 'switch', 'aria-checked': String(s.settings.autoAlternateWeeks), onclick: (e) => {
          const v = !s.settings.autoAlternateWeeks;
          set('autoAlternateWeeks', v);
          e.currentTarget.setAttribute('aria-checked', String(v));
        }}),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Deload every N weeks (4–8)'),
        el('input', { type: 'number', min: '4', max: '8', value: String(s.settings.deloadEvery || 6), oninput: (e) => set('deloadEvery', Math.max(4, Math.min(8, parseInt(e.target.value, 10) || 6))) }),
      ]),
    ]),

    // ---- Apple Health / Apple Watch ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Apple Health / Apple Watch']),
      el('p', { class: 'muted', style: { margin: '6px 0' } },
        'Web apps cannot read Apple Health or Apple Watch directly (Apple blocks this for browsers). You have two options:'),
      el('div', { class: 'card flat', style: { padding: '10px' } }, [
        el('strong', {}, '1. Import Health XML (recommended)'),
        el('p', { class: 'faint', style: { margin: '4px 0' } },
          'On iPhone: Health app → tap your profile (top-right) → scroll down → Export All Health Data → unzip → upload the export.xml here. The app pulls in your runs, weight, and resting HR from the last 90 days. Do this weekly.'),
        el('input', { type: 'file', accept: '.xml,application/xml,text/xml', onchange: handleHealthImport, id: 'healthFile' }),
      ]),
      el('div', { class: 'card flat', style: { padding: '10px' } }, [
        el('strong', {}, '2. Use the native iOS version'),
        el('p', { class: 'faint', style: { margin: '4px 0' } },
          'For real-time Apple Health and Apple Watch sync, you need the native app. The Swift/SwiftUI scaffold is in `liftrun-ios/` — needs a Mac + Xcode to build (or a developer with one).'),
      ]),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Notifications']),
      el('p', { class: 'muted', style: { margin: '0 0 8px' } }, 'For the rest timer when the app is backgrounded. iOS requires Add-to-Home-Screen + iOS 16.4+ for web notifications.'),
      el('button', { class: 'btn', onclick: async () => {
        const r = await requestNotificationPermission();
        toast(r === 'granted' ? 'Notifications enabled' : `Permission: ${r}`, r === 'granted' ? 'success' : 'error');
      } }, 'Enable notifications'),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Body']),
      el('button', { class: 'btn block', onclick: () => router.go('body') }, 'Open Body'),
    ]),

    // ---- Nudges ----
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Smart nudges']),
      el('p', { class: 'faint' }, "Local notifications that fire while the app is open or installed. Requires notifications enabled."),
      toggleRow('Sleep early before Legs', s.nudges?.sleepEarlyBeforeLegs ?? true, v => S.setNudges({ sleepEarlyBeforeLegs: v })),
      toggleRow('Carb fuel reminder before Legs', s.nudges?.fuelBeforeLegs ?? true, v => S.setNudges({ fuelBeforeLegs: v })),
      el('div', { class: 'field' }, [
        el('label', {}, 'Caffeine window before training (min, 0 = off)'),
        el('input', { type: 'number', min: '0', max: '60', value: String(s.nudges?.caffeineMinBeforeWorkout ?? 30), oninput: e => S.setNudges({ caffeineMinBeforeWorkout: parseInt(e.target.value, 10) || 0 }) }),
      ]),
      toggleRow('Adherence check-in (3+ days idle)', s.nudges?.lowAdherenceCheckin ?? true, v => S.setNudges({ lowAdherenceCheckin: v })),
    ]),

    // ---- Volume landmarks ----
    el('details', { class: 'card' }, [
      el('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, 'Custom volume landmarks (advanced)'),
      el('p', { class: 'faint' }, 'Override the per-muscle MEV / MAV / MRV defaults. Empty values use defaults.'),
      ...['chest','lats','mid-back','shoulders','rear-delts','biceps','triceps','quads','hamstrings','glutes','calves'].map(m => {
        const cur = s.customVolumeLandmarks?.[m] || {};
        return el('div', { class: 'field' }, [
          el('label', {}, m),
          el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' } }, [
            el('input', { type: 'number', placeholder: 'MEV', value: cur.mev ?? '', oninput: e => S.setCustomLandmarks(m, { mev: parseFloat(e.target.value) || undefined }) }),
            el('input', { type: 'number', placeholder: 'MAV', value: cur.mav ?? '', oninput: e => S.setCustomLandmarks(m, { mav: parseFloat(e.target.value) || undefined }) }),
            el('input', { type: 'number', placeholder: 'MRV', value: cur.mrv ?? '', oninput: e => S.setCustomLandmarks(m, { mrv: parseFloat(e.target.value) || undefined }) }),
          ]),
        ]);
      }),
    ]),

    // Full-device backup — all profiles + photos in one file (the safety net against eviction).
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Backup & restore']),
      el('p', { class: 'faint', style: { margin: '6px 0 8px' } }, 'Saves ALL profiles + photos to one file. Your data lives only on this device — back up regularly so clearing your browser or changing phones can\'t wipe your history.'),
      el('div', { id: 'backupStatus', style: { margin: '0 0 10px', fontSize: '12px', color: 'var(--text-dim)' } }, 'Checking storage…'),
      el('div', { class: 'row-flex' }, [
        el('button', { class: 'btn primary', onclick: backupNow }, 'Back up now'),
        el('button', { class: 'btn', onclick: restoreNow }, 'Restore from file'),
      ]),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Export this profile']),
      el('div', { class: 'row-flex' }, [
        el('button', { class: 'btn', onclick: () => exportData() }, 'Export JSON'),
        el('button', { class: 'btn', onclick: () => exportCsv() }, 'Export CSV (sets)'),
        el('button', { class: 'btn ghost', onclick: () => importData() }, 'Import JSON'),
      ]),
      el('p', { class: 'faint' }, 'Exports just the active profile (handy for sharing a single account). For a complete safety backup, use Backup & restore above.'),
    ]),

    // Optional cloud sync via the user's own Supabase project.
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Cloud sync (beta)']),
      el('p', { class: 'faint', style: { margin: '6px 0 10px' } }, 'Optional. Sign in to back up + sync your profiles across devices using your own free Supabase project. The app works fully offline without it.'),
      (() => {
        if (!Sync.isConfigured()) {
          return el('div', {}, [
            el('div', { class: 'field' }, [el('label', {}, 'Supabase URL'), el('input', { id: 'sbUrl', type: 'url', placeholder: 'https://xxxx.supabase.co' })]),
            el('div', { class: 'field' }, [el('label', {}, 'Anon public key'), el('input', { id: 'sbKey', type: 'text', placeholder: 'eyJ…' })]),
            el('button', { class: 'btn primary block', onclick: saveConn }, 'Save connection'),
            setupDetails(),
          ]);
        }
        if (!Sync.isSignedIn()) {
          return el('div', {}, [
            el('div', { class: 'field' }, [el('label', {}, 'Email'), el('input', { id: 'sbEmail', type: 'email', autocomplete: 'email' })]),
            el('div', { class: 'field' }, [el('label', {}, 'Password'), el('input', { id: 'sbPass', type: 'password' })]),
            el('div', { class: 'row-flex', style: { gap: '8px' } }, [
              el('button', { class: 'btn primary', style: { flex: '1' }, onclick: doSignIn }, 'Sign in'),
              el('button', { class: 'btn', style: { flex: '1' }, onclick: doSignUp }, 'Create account'),
            ]),
            el('button', { class: 'btn ghost block', style: { marginTop: '6px' }, onclick: () => { Sync.clearConfig(); router.refresh(); } }, 'Change connection'),
            setupDetails(),
          ]);
        }
        return el('div', {}, [
          el('p', { style: { margin: '0 0 6px' } }, ['Signed in as ', el('strong', {}, Sync.currentEmail() || '')]),
          el('p', { class: 'faint', style: { margin: '0 0 10px', fontSize: '12px' } }, Sync.lastSyncedAt() ? `Last synced ${fmtDate(Sync.lastSyncedAt())}` : 'Not synced yet — tap Sync now.'),
          el('div', { class: 'row-flex', style: { gap: '8px' } }, [
            el('button', { class: 'btn primary', onclick: doSyncNow }, 'Sync now'),
            el('button', { class: 'btn ghost', onclick: () => { Sync.signOut(); toast('Signed out'); router.refresh(); } }, 'Sign out'),
          ]),
          el('div', { class: 'toggle', style: { marginTop: '8px' } }, [
            el('div', { class: 'label' }, 'Auto-sync on changes'),
            el('button', { class: 'switch', 'aria-checked': String(Sync.autoSyncEnabled()), onclick: () => { Sync.setAutoSync(!Sync.autoSyncEnabled()); router.refresh(); } }),
          ]),
        ]);
      })(),
    ]),

    // On-device diagnostics (error log) — copy/paste for bug reports.
    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Diagnostics']),
      el('p', { class: 'faint', style: { margin: '6px 0 8px' } }, `${Diag.getLog().length} recent error(s) recorded on this device. If something misbehaves, copy this and send it.`),
      el('details', {}, [
        el('summary', { class: 'faint', style: { cursor: 'pointer' } }, 'Show error log'),
        el('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '11px', color: 'var(--text-dim)', maxHeight: '200px', overflow: 'auto', marginTop: '8px' } }, Diag.asText()),
        el('div', { class: 'row-flex', style: { marginTop: '8px' } }, [
          el('button', { class: 'btn sm', onclick: async () => { try { await navigator.clipboard.writeText(Diag.asText()); toast('Copied'); } catch { toast('Copy failed', 'error'); } } }, 'Copy'),
          el('button', { class: 'btn sm ghost', onclick: () => { Diag.clearLog(); toast('Cleared'); router.refresh(); } }, 'Clear'),
        ]),
      ]),
    ]),

    el('div', { class: 'card flat', style: { textAlign: 'center' } }, [
      el('button', { class: 'btn ghost', onclick: () => router.openSheet('about') }, 'About & legal'),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'eyebrow' }, ['Danger zone']),
      el('button', { class: 'btn danger', onclick: async () => {
        if (!await confirmAction({ title: 'Erase everything?', body: 'Deletes all workouts, runs, photos, and settings. This cannot be undone. Export a backup first if unsure.', confirmLabel: 'Erase all' })) return;
        S.reset();
        toast('Reset complete');
        router.go('onboarding');
      } }, 'Reset all data'),
    ]),

    el('p', { class: 'faint center' }, [`LiftRun · personal build · v1`]),
  ]));

  // Fill the backup status line (storage estimate + persistence are async).
  refreshBackupStatus();

  function set(k, v) {
    haptic('light');
    S.setSetting(k, v);
    // Re-render so the selected segment (the orange "primary" highlight) follows the tap.
    // Theme/text-size also need this — previously only units/provider refreshed, so the
    // highlight stayed stuck on the old option even though the setting applied.
    router.refresh();
  }

  async function refreshBackupStatus() {
    const node = document.getElementById('backupStatus');
    if (!node) return;
    const last = Backup.lastBackupAt();
    const persisted = await Backup.isPersisted();
    const est = await Backup.storageEstimate();
    const lastTxt = last ? `Last backup ${fmtDate(last)}` : '⚠ No backup yet';
    const storeTxt = est ? ` · ${est.usedMB} MB used` : '';
    const persistTxt = persisted ? ' · 🔒 storage protected' : ' · ⚠ storage not protected';
    const n2 = document.getElementById('backupStatus');
    if (n2) { n2.textContent = lastTxt + storeTxt + persistTxt; if (Backup.needsBackup()) n2.style.color = 'var(--warn)'; }
  }

  async function backupNow() {
    haptic('medium');
    try { const n = await Backup.downloadBackup(); toast(`Backed up · ${n} photo${n === 1 ? '' : 's'} included`, 'success'); refreshBackupStatus(); }
    catch { toast('Backup failed', 'error'); }
  }

  function restoreNow() {
    const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } }));
    document.body.appendChild(inp);
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      if (!await confirmAction({ title: 'Restore backup?', body: 'Replaces ALL profiles and data on this device with the contents of the backup file. Current data will be overwritten.', confirmLabel: 'Restore' })) return;
      try {
        const n = await Backup.restoreFromFile(f);
        toast(`Restored ${n} profile${n === 1 ? '' : 's'} — reloading…`, 'success');
        setTimeout(() => location.reload(), 900);
      } catch (err) { toast(/** @type {any} */ (err)?.message || 'Restore failed', 'error'); }
    };
    inp.click();
  }

  // ---- Cloud sync handlers ----
  function saveConn() {
    const url = /** @type {HTMLInputElement|null} */ (document.getElementById('sbUrl'))?.value;
    const key = /** @type {HTMLInputElement|null} */ (document.getElementById('sbKey'))?.value;
    if (!url || !key) { toast('Enter your Supabase URL and anon key', 'error'); return; }
    Sync.setConfig(url, key); toast('Connection saved', 'success'); router.refresh();
  }
  async function doSignIn() {
    const email = /** @type {HTMLInputElement|null} */ (document.getElementById('sbEmail'))?.value || '';
    const pass = /** @type {HTMLInputElement|null} */ (document.getElementById('sbPass'))?.value || '';
    try { await Sync.signIn(email, pass); toast('Signed in', 'success'); router.refresh(); firstSync(); }
    catch (e) { toast(/** @type {any} */ (e)?.message || 'Sign-in failed', 'error'); }
  }
  async function doSignUp() {
    const email = /** @type {HTMLInputElement|null} */ (document.getElementById('sbEmail'))?.value || '';
    const pass = /** @type {HTMLInputElement|null} */ (document.getElementById('sbPass'))?.value || '';
    try {
      const r = await Sync.signUp(email, pass);
      if (r.signedIn) { toast('Account created', 'success'); router.refresh(); firstSync(); }
      else toast('Almost there — confirm via the email Supabase sent, then Sign in.', 'success');
    } catch (e) { toast(/** @type {any} */ (e)?.message || 'Sign-up failed', 'error'); }
  }
  async function doSyncNow() {
    haptic('medium');
    try { const r = await Sync.syncNow(); toast(`Synced · ↓${r.pulled + r.restored} ↑${r.pushed}${r.conflicts ? ` · ${r.conflicts} kept on-device` : ''}`, 'success'); router.refresh(); }
    catch (e) { toast(/** @type {any} */ (e)?.message || 'Sync failed', 'error'); }
  }
  async function firstSync() { try { await Sync.syncNow(); router.refresh(); } catch {} }
  function setupDetails() {
    return el('details', { style: { marginTop: '10px' } }, [
      el('summary', { class: 'faint', style: { cursor: 'pointer' } }, 'How to set up (free · ~5 min)'),
      el('ol', { class: 'muted', style: { fontSize: '13px', lineHeight: '1.6', paddingLeft: '18px', margin: '8px 0' } }, [
        el('li', {}, 'Create a free project at supabase.com.'),
        el('li', {}, 'Project Settings → API: copy the Project URL + anon public key into the fields above.'),
        el('li', {}, 'SQL Editor: paste + run the snippet below — it makes the table and row-level security so each account only sees its own data.'),
        el('li', {}, 'Authentication → Email: turn off "Confirm email" for instant sign-up (or keep it on and confirm by email).'),
      ]),
      el('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '10px', background: 'var(--bg-3)', padding: '10px', borderRadius: '8px', overflow: 'auto', maxHeight: '220px' } }, SUPABASE_SQL),
      el('button', { class: 'btn sm', onclick: async () => { try { await navigator.clipboard.writeText(SUPABASE_SQL); toast('SQL copied'); } catch { toast('Copy failed', 'error'); } } }, 'Copy SQL'),
    ]);
  }
}

async function handleHealthImport(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  if (f.size > 80 * 1024 * 1024) {
    toast(`File is ${Math.round(f.size / 1024 / 1024)}MB — limit your export window in iOS first.`, 'error');
    return;
  }
  toast('Parsing Health data…');
  try {
    const result = await importHealthXML(f);
    const msg = `Imported: ${result.runs} runs, ${result.bodyMass} body-weight entries${result.restingHR ? `, resting HR ${result.restingHR} bpm` : ''}.`;
    toast(msg, 'success');
    e.target.value = '';
    if (result.errors.length) console.warn('Health import warnings:', result.errors);
  } catch (err) {
    toast(`Import failed: ${/** @type {any} */ (err)?.message}`, 'error');
  }
}

function toggleRow(label, value, setter) {
  const wrap = el('div', { class: 'toggle' }, [
    el('div', { class: 'label' }, label),
    el('button', { class: 'switch', 'aria-checked': String(value), onclick: (e) => {
      const v = !value;
      setter(v);
      e.currentTarget.setAttribute('aria-checked', String(v));
      value = v;
    } }),
  ]);
  return wrap;
}

function keyPlaceholder(provider) {
  switch (provider) {
    case 'gemini':    return 'AIza…';
    case 'groq':      return 'gsk_…';
    case 'openai':    return 'sk-…';
    case 'anthropic':
    default:          return 'sk-ant-…';
  }
}
function modelPlaceholder(provider) {
  switch (provider) {
    case 'gemini':    return 'gemini-2.0-flash';
    case 'groq':      return 'llama-3.3-70b-versatile';
    case 'openai':    return 'gpt-4o-mini';
    case 'anthropic':
    default:          return 'claude-opus-4-7';
  }
}
function modelHint(provider) {
  switch (provider) {
    case 'gemini': return 'Free tier. Defaults to gemini-2.0-flash. Other options: gemini-2.5-flash, gemini-2.5-pro.';
    case 'groq':   return 'Free, very fast (Llama on custom hardware). Default llama-3.3-70b-versatile. Check console.groq.com/docs/models for current list.';
    case 'openai': return 'Paid. Default gpt-4o-mini is cheap.';
    case 'anthropic':
    default:       return 'Paid. Check docs.claude.com for current model names.';
  }
}

function exportData() {
  const data = S.exportAll();
  download('liftrun-backup.json', data, 'application/json');
}
function exportCsv() {
  const s = S.get();
  const rows = [['date', 'session', 'exercise', 'set_type', 'weight_kg', 'reps', 'rpe']];
  for (const set of s.sets) {
    const ses = s.sessions.find(x => x.id === set.sessionId);
    rows.push([set.createdAt, ses?.dayLabel || '', set.exerciseId, set.type, set.weightKg, set.reps, set.rpe ?? '']);
  }
  download('liftrun-sets.csv', rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
}
function importData() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files?.[0];
    if (!f) return;
    const text = await f.text();
    try {
      if (S.importAll(text)) toast('Imported', 'success');
    } catch (e) { toast('Import failed: ' + /** @type {any} */ (e)?.message, 'error'); }
  };
  inp.click();
}
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
