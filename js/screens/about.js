// About + legal: medical/safety disclaimer, privacy summary, terms. Plain-language DRAFTS —
// anything shipped commercially should be reviewed by a qualified professional / lawyer.
import { el } from '../util.js';

const APP_VERSION = 'v30';

function section(title, paras) {
  return el('div', { style: { marginTop: '18px' } }, [
    el('h3', { style: { margin: '0 0 6px' } }, title),
    ...paras.map(p => el('p', { class: 'muted', style: { margin: '0 0 8px', fontSize: '14px', lineHeight: '1.5' } }, p)),
  ]);
}

export function renderAboutSheet(sheetBody, ctx, router) {
  sheetBody.replaceChildren(
    el('div', { class: 'grabber' }),
    el('h2', { style: { margin: '0 0 2px' } }, 'About & legal'),
    el('p', { class: 'faint', style: { marginTop: 0 } }, `LiftRun ${APP_VERSION} · a personal training companion`),

    el('div', { class: 'card', style: { borderColor: 'var(--warn)', marginTop: '12px' } }, [
      el('strong', { style: { color: 'var(--warn)' } }, '⚠ Health & safety disclaimer'),
      el('p', { class: 'muted', style: { margin: '6px 0 0', fontSize: '14px', lineHeight: '1.5' } },
        'LiftRun provides general fitness, training and nutrition information for educational purposes only. It is not medical advice and is not a substitute for a doctor, physiotherapist, or registered dietitian. Consult a qualified professional before starting any exercise or diet programme, especially if you have an injury, a medical condition, or are pregnant. Stop and seek help if you feel sharp pain, dizziness, or chest discomfort. You train at your own risk.'),
    ]),

    section('Your data & privacy', [
      'Everything you log — workouts, runs, body metrics, photos and diet — is stored locally on this device only. There is no LiftRun server and your data is never uploaded to us.',
      'Profiles are separate accounts on this device. An optional PIN is light privacy only (not encryption): anyone with the unlocked device can read the data.',
      'AI coaching is optional. When enabled, your prompts (and any photos you submit for analysis) are sent directly from your device to the AI provider you choose (Google, Groq, OpenAI or Anthropic), using your own API key. Their use of that data is governed by that provider\'s privacy policy.',
      'Because data lives only on this device, it can be lost if you clear your browser, delete the app, or the OS reclaims storage. Use Settings → Backup & restore regularly, and keep the backup file somewhere safe.',
    ]),

    section('Terms of use', [
      'LiftRun is provided “as is”, without warranty of any kind. To the maximum extent permitted by law, the authors are not liable for any injury, loss of data, or damages arising from use of the app.',
      'You are responsible for the accuracy of what you log and for any third-party API keys you add. Use the app lawfully and at your own discretion.',
    ]),

    el('p', { class: 'faint', style: { marginTop: '18px', fontSize: '12px' } },
      'These notices are plain-language drafts for a personal app. Before distributing or selling LiftRun, have a lawyer review the privacy policy and terms, and a medical professional review the health guidance.'),

    el('button', { class: 'btn block', style: { marginTop: '12px' }, onclick: () => router.closeSheet() }, 'Close'),
  );
}
