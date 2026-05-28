// Local account gate + profile manager. Renders BEFORE the app when a profile must be
// chosen/created/unlocked, and provides an in-app sheet to switch/manage profiles.
import { el, haptic, toast, emit } from '../util.js';
import * as Profiles from '../profiles.js';
import * as S from '../state.js';
import { confirmAction, promptInput } from '../ui.js';

const THEMES = [
  { id: 'dark',   label: '🌙 Dark',   color: '#ff6438' },
  { id: 'pink',   label: '🌸 Pink',   color: '#ec4899' },
  { id: 'light',  label: '☀ Light',   color: '#e85529' },
  { id: 'system', label: '⚙ System',  color: '#8b95a1' },
];
const themeColor = (t) => (THEMES.find(x => x.id === t) || THEMES[0]).color;
const initials = (name) => (name || '?').trim().slice(0, 2).toUpperCase();

const LOGO = `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12"/></svg>`;

function avatar(p, size = 44) {
  return el('div', { style: {
    width: size + 'px', height: size + 'px', borderRadius: '50%', flex: '0 0 auto',
    background: p.accent || '#ff6438', color: '#fff', fontWeight: '800',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: Math.round(size * 0.36) + 'px', letterSpacing: '.02em',
  } }, initials(p.name));
}

/**
 * Full-screen boot gate. Resolves by activating + unlocking a profile, then calls onDone(id).
 * @param {{ mode?: 'create'|'pin'|'picker', id?: string|null, onDone: (id: string) => void }} opts
 */
export function mountGate({ mode = 'create', id = null, onDone }) {
  const tabbar = document.getElementById('tabbar');
  if (tabbar) tabbar.style.display = 'none';
  const overlay = el('div', { class: 'account-gate' });
  document.body.appendChild(overlay);

  function finish(pid) {
    if (tabbar) tabbar.style.display = '';
    overlay.remove();
    onDone(pid);
  }
  function shell(children) { overlay.replaceChildren(el('div', { class: 'account-inner' }, children)); }

  // ----- Create -----
  function renderCreate(canBack) {
    const form = { name: '', theme: 'dark', pin: '', usePin: false };
    document.documentElement.setAttribute('data-theme', form.theme);
    const draw = () => {
      shell([
        el('div', { class: 'account-logo' }, [el('span', { html: LOGO })]),
        el('h1', { style: { margin: '0 0 4px', textAlign: 'center' } }, Profiles.listProfiles().length ? 'New profile' : 'Welcome to LiftRun'),
        el('p', { class: 'muted', style: { textAlign: 'center', margin: '0 0 18px' } }, 'Your workouts and look are saved to this profile on this device.'),
        el('div', { class: 'field' }, [
          el('label', {}, 'Your name'),
          el('input', { type: 'text', placeholder: 'e.g. anu', value: form.name, maxlength: '24',
            oninput: (e) => { form.name = e.target.value; } }),
        ]),
        el('div', { class: 'field' }, [
          el('label', {}, 'Pick your colour'),
          el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' } },
            THEMES.map(t => el('button', {
              class: `btn ${form.theme === t.id ? 'primary' : ''}`,
              onclick: () => { form.theme = t.id; haptic('select'); document.documentElement.setAttribute('data-theme', t.id); draw(); },
            }, t.label))),
        ]),
        el('div', { class: 'toggle', style: { borderBottom: '0', padding: '6px 0' } }, [
          el('div', { class: 'label' }, 'Lock with a PIN'),
          el('button', { class: 'switch', 'aria-checked': String(form.usePin),
            onclick: () => { form.usePin = !form.usePin; if (!form.usePin) form.pin = ''; draw(); } }),
        ]),
        form.usePin ? el('div', { class: 'field' }, [
          el('input', { type: 'tel', inputmode: 'numeric', maxlength: '8', placeholder: 'Choose a PIN', value: form.pin,
            oninput: (e) => { form.pin = e.target.value.replace(/\D/g, ''); } }),
          el('p', { class: 'faint' }, 'Asked once each time you open the app. Light privacy only — not encryption.'),
        ]) : null,
        el('button', { class: 'btn primary lg block', style: { marginTop: '8px' }, onclick: submit }, 'Create profile'),
        canBack ? el('button', { class: 'btn ghost block', style: { marginTop: '6px' }, onclick: () => renderPicker() }, 'Back') : null,
      ]);
    };
    async function submit() {
      if (form.usePin && form.pin.length < 3) { toast('PIN needs at least 3 digits', 'error'); return; }
      haptic('medium');
      const pid = await Profiles.createProfile({
        name: form.name, theme: form.theme, accent: themeColor(form.theme), pin: form.usePin ? form.pin : '',
      });
      finish(pid);
    }
    draw();
  }

  // ----- PIN unlock -----
  function renderPin(pid) {
    const p = Profiles.getProfile(pid);
    if (!p) { renderPicker(); return; }
    document.documentElement.setAttribute('data-theme', 'dark');
    let pin = '';
    const draw = (err) => {
      shell([
        avatar(p, 64),
        el('h1', { style: { margin: '12px 0 2px', textAlign: 'center' } }, p.name),
        el('p', { class: 'muted', style: { textAlign: 'center', margin: '0 0 18px' } }, 'Enter your PIN to continue.'),
        el('input', { type: 'tel', inputmode: 'numeric', maxlength: '8', placeholder: '••••',
          style: { textAlign: 'center', fontSize: '24px', letterSpacing: '.4em', fontWeight: '700' },
          value: pin, oninput: (e) => { pin = e.target.value.replace(/\D/g, ''); } }),
        err ? el('p', { style: { color: 'var(--bad)', textAlign: 'center', margin: '8px 0 0' } }, err) : null,
        el('button', { class: 'btn primary lg block', style: { marginTop: '12px' }, onclick: tryUnlock }, 'Unlock'),
        Profiles.listProfiles().length > 1
          ? el('button', { class: 'btn ghost block', style: { marginTop: '6px' }, onclick: () => renderPicker() }, 'Use a different profile')
          : null,
      ]);
      const inp = overlay.querySelector('input');
      if (inp) setTimeout(() => inp.focus(), 50);
    };
    async function tryUnlock() {
      if (await Profiles.verifyPin(pid, pin)) {
        Profiles.markUnlocked(pid);
        Profiles.activate(pid);
        haptic('success');
        finish(pid);
      } else { haptic('error'); pin = ''; draw('Wrong PIN — try again.'); }
    }
    draw();
  }

  // ----- Picker -----
  function renderPicker() {
    document.documentElement.setAttribute('data-theme', 'dark');
    const list = Profiles.listProfiles();
    shell([
      el('h1', { style: { margin: '0 0 4px', textAlign: 'center' } }, 'Who\'s training?'),
      el('p', { class: 'muted', style: { textAlign: 'center', margin: '0 0 18px' } }, 'Choose a profile.'),
      el('div', { class: 'list' }, list.map(p => el('button', { class: 'row-btn', style: { padding: '12px 0', width: '100%' }, onclick: () => pick(p) }, [
        el('div', { class: 'list-item', style: { width: '100%', borderBottom: '0', padding: 0 } }, [
          avatar(p),
          el('div', {}, [
            el('div', { style: { fontWeight: 700 } }, p.name),
            el('div', { class: 'faint' }, p.pinHash ? '🔒 PIN protected' : 'Tap to open'),
          ]),
        ]),
      ]))),
      el('button', { class: 'btn block', style: { marginTop: '12px' }, onclick: () => renderCreate(true) }, '+ Add a profile'),
    ]);
    function pick(p) {
      haptic('light');
      if (p.pinHash && !Profiles.isUnlocked(p.id)) { renderPin(p.id); return; }
      Profiles.activate(p.id);
      finish(p.id);
    }
  }

  if (mode === 'pin') renderPin(id || Profiles.activeId());
  else if (mode === 'picker') renderPicker();
  else renderCreate(Profiles.listProfiles().length > 0);
}

/**
 * In-app profile manager (Settings → Profiles). Switch, add, rename, PIN, delete.
 * @param {HTMLElement} sheetBody @param {any} ctx @param {any} router
 */
export function renderProfilesSheet(sheetBody, ctx, router) {
  draw();
  function draw() {
    const list = Profiles.listProfiles();
    const active = Profiles.activeId();
    sheetBody.replaceChildren(
      el('div', { class: 'grabber' }),
      el('h2', { style: { margin: '0 0 4px' } }, 'Profiles'),
      el('p', { class: 'muted', style: { marginTop: 0 } }, 'Separate accounts on this device — each keeps its own workouts, settings and colour.'),
      el('div', { class: 'list' }, list.map(p => el('div', { class: 'list-item' }, [
        avatar(p, 38),
        el('div', { style: { minWidth: 0 } }, [
          el('div', { style: { fontWeight: 600 } }, [p.name, p.id === active ? el('span', { class: 'pill good', style: { marginLeft: '8px' } }, 'Active') : null]),
          el('div', { class: 'faint' }, p.pinHash ? '🔒 PIN set' : 'No PIN'),
        ]),
        el('div', { class: 'row-action', style: { marginLeft: 'auto' } }, [
          p.id === active
            ? el('button', { class: 'btn sm ghost', onclick: () => manage(p) }, 'Manage')
            : el('button', { class: 'btn sm primary', onclick: () => switchTo(p) }, 'Switch'),
        ]),
      ]))),
      el('button', { class: 'btn block', style: { marginTop: '10px' }, onclick: addProfile }, '+ Add a profile'),
    );
  }

  function addProfile() {
    // Re-open the boot gate in create mode; on done, reload into the new profile.
    router.closeSheet();
    mountGate({ mode: 'create', onDone: () => { afterSwitch(); } });
  }

  async function switchTo(p) {
    if (p.pinHash && !Profiles.isUnlocked(p.id)) {
      const pin = await promptInput({ title: `Unlock ${p.name}`, placeholder: 'PIN', type: 'tel', confirmLabel: 'Unlock' });
      if (pin == null) return;
      if (!(await Profiles.verifyPin(p.id, pin))) { toast('Wrong PIN', 'error'); return; }
      Profiles.markUnlocked(p.id);
    }
    Profiles.activate(p.id);
    haptic('success');
    afterSwitch();
  }

  function afterSwitch() {
    emit('state', S.get());        // triggers applyAppearance (theme) in app.js
    router.closeSheet();
    router.go('today');
    toast('Switched profile', 'success');
  }

  async function manage(p) {
    const choice = await pickAction(p);
    if (choice === 'rename') {
      const name = await promptInput({ title: 'Rename profile', defaultValue: p.name, confirmLabel: 'Save' });
      if (name) { Profiles.renameProfile(p.id, name); draw(); }
    } else if (choice === 'pin') {
      const pin = await promptInput({ title: p.pinHash ? 'Change / clear PIN' : 'Set a PIN', body: 'Leave blank to remove the PIN.', placeholder: 'PIN (blank = none)', type: 'tel', confirmLabel: 'Save' });
      if (pin == null) return;
      await Profiles.setPin(p.id, pin.replace(/\D/g, ''));
      toast(pin ? 'PIN updated' : 'PIN removed', 'success');
      draw();
    } else if (choice === 'delete') {
      if (Profiles.listProfiles().length <= 1) { toast('Can\'t delete your only profile', 'error'); return; }
      if (!await confirmAction({ title: `Delete ${p.name}?`, body: 'This permanently erases this profile\'s data on this device.', confirmLabel: 'Delete' })) return;
      Profiles.deleteProfile(p.id);
      toast('Profile deleted');
      // If we deleted the active one, switch to whatever is now active.
      const next = Profiles.activeId();
      if (next) Profiles.activate(next);
      afterSwitch();
    }
  }

  // Tiny inline action chooser rendered into the sheet.
  function pickAction(p) {
    return new Promise((resolve) => {
      sheetBody.replaceChildren(
        el('div', { class: 'grabber' }),
        el('h2', { style: { margin: '0 0 12px' } }, p.name),
        el('button', { class: 'btn block', style: { marginBottom: '8px' }, onclick: () => resolve('rename') }, 'Rename'),
        el('button', { class: 'btn block', style: { marginBottom: '8px' }, onclick: () => resolve('pin') }, p.pinHash ? 'Change / remove PIN' : 'Set a PIN'),
        el('button', { class: 'btn block danger', style: { marginBottom: '8px' }, onclick: () => resolve('delete') }, 'Delete profile'),
        el('button', { class: 'btn ghost block', onclick: () => { resolve(null); draw(); } }, 'Back'),
      );
    });
  }
}
