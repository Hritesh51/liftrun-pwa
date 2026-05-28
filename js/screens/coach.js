import { el, haptic, toast } from '../util.js';
import * as S from '../state.js';
import * as coach from '../coach.js';
import { renderMarkdown, skeleton } from '../ui.js';

export function render(view, router) {
  const s = S.get();
  const wrap = el('div', {}, [
    el('div', { class: 'h-row' }, [
      el('h1', {}, 'Coach'),
      el('button', { class: 'btn sm', onclick: () => weeklyReview() }, 'Weekly review'),
      el('button', { class: 'btn sm primary', onclick: () => weeklyStrategy() }, 'Strategy →'),
    ]),
    coach.isConfigured()
      ? el('div', { class: 'pill good', style: { marginBottom: '12px' } }, ['AI online'])
      : el('div', { class: 'card' }, [
          el('strong', {}, 'Add your API key to enable AI'),
          el('p', { class: 'muted' }, 'The app is fully usable without it — local progression keeps you moving. The AI just makes suggestions more personal.'),
          el('button', { class: 'btn primary', onclick: () => router.go('settings') }, 'Open Settings'),
        ]),
    el('div', { id: 'chatlog', class: 'chat' }, s.coachMessages.map(m => {
      const bubble = el('div', { class: `bubble ${m.role}` });
      if (m.role === 'assistant') bubble.appendChild(renderMarkdown(m.text));
      else bubble.textContent = m.text;
      return bubble;
    })),
    el('div', { class: 'spacer' }),
  ]);
  view.replaceChildren(wrap);

  // Composer (fixed at bottom)
  const composer = el('div', { class: 'composer' }, [
    el('textarea', { id: 'msgIn', placeholder: coach.isConfigured() ? 'Ask the coach…' : 'Add API key in Settings first', rows: 1, onkeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    }}),
    el('button', { class: 'btn primary', onclick: send }, 'Send'),
  ]);
  document.body.appendChild(composer);
  scrollChatToBottom();

  // Clean up composer on route change
  const removeOnLeave = () => composer.remove();
  router.onLeave = removeOnLeave;

  async function send() {
    const ta = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('msgIn'));
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) return;
    ta.value = '';
    haptic('light');
    S.pushCoachMessage({ role: 'user', text });
    const log = /** @type {HTMLElement} */ (document.getElementById('chatlog'));
    log.appendChild(el('div', { class: 'bubble user' }, text));
    const thinking = el('div', { class: 'bubble assistant' });
    thinking.appendChild(skeleton({ width: '60%', height: '14px' }));
    thinking.appendChild(skeleton({ width: '80%', height: '14px' }));
    thinking.appendChild(skeleton({ width: '40%', height: '14px' }));
    log.appendChild(thinking);
    scrollChatToBottom();

    const res = await coach.chat(text);
    thinking.replaceChildren(renderMarkdown(res.text));
    S.pushCoachMessage({ role: 'assistant', text: res.text });
    scrollChatToBottom();
  }

  async function weeklyReview() {
    haptic('light');
    const log = /** @type {HTMLElement} */ (document.getElementById('chatlog'));
    const note = el('div', { class: 'bubble assistant' }, 'Running weekly review…');
    log.appendChild(note);
    scrollChatToBottom();
    const res = await coach.weeklyReviewAsk();
    note.textContent = res.text;
    S.pushCoachMessage({ role: 'assistant', text: res.text });
    scrollChatToBottom();
  }

  async function weeklyStrategy() {
    haptic('medium');
    const log = /** @type {HTMLElement} */ (document.getElementById('chatlog'));
    const note = el('div', { class: 'bubble assistant' }, 'Building next-week strategy…');
    log.appendChild(note);
    scrollChatToBottom();
    const res = await coach.weeklyStrategy();
    note.textContent = res.text;
    S.pushCoachMessage({ role: 'assistant', text: res.text });
    scrollChatToBottom();
  }
}

function scrollChatToBottom() {
  requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
}
