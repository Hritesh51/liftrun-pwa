# LiftRun — Personal Strength + Running PWA

A single-user iPhone-installable web app for a 6-day Push/Pull/Legs program (with an optional alternating bro split), running, and an AI coach that uses your own LLM API key.

This is the **PWA delivery** of the spec — it installs to your iPhone home screen via Safari and runs offline-first. There is no Apple Developer account, no Xcode, no App Store. Everything lives on your phone.

## What works in this build

- Push/Pull/Legs (Week A) + Bro Split (Week B), auto-alternating
- Fast set logging: weight/reps steppers, RPE, set types, per-exercise history, auto-fill from last set
- Local **double-progression** engine (offline-safe) suggests every next set
- Rest timer with circular FAB, vibration, notification, wake lock
- Exercise library (28+ lifts) with form cues and a YouTube-search demo link
- In-app GPS run tracking + manual run logging
- Progress: weekly volume per muscle, e1RM trends, adherence heatmap, bodyweight chart, PR list
- Coach chat (Anthropic Claude or OpenAI) — uses your own API key, never bundled
- Weekly review, plateau detection, readiness check-in (autoregulation)
- Deload weeks auto-scheduled every 5–7 weeks (configurable)
- JSON/CSV export, settings, full reset

## Honest limitations vs. native iOS

- No **Apple Health / HealthKit** — web apps cannot read from it
- **Background GPS** stops when the screen locks (iOS suspends web apps). Keep the app open + screen on during a run, or log runs manually after a treadmill / Apple Watch session
- **Background rest timer** — the timer keeps running while the app is open; when backgrounded, a scheduled local notification fires at the end (requires iOS 16.4+ and the app installed via Add to Home Screen)
- No **Apple Watch** companion

If you outgrow these, the data exports to JSON and the native version (Phase 2) reads it back.

## Install on your iPhone — three options

You need to host the folder somewhere your iPhone Safari can reach. Pick one:

### Option A — GitHub Pages (recommended, free, permanent)
1. Create a free GitHub account if you don't have one
2. Make a new public repository (e.g. `liftrun`)
3. Upload everything from this folder (or `git push`)
4. In repo Settings → Pages → Source = `Deploy from a branch`, Branch = `main`, Folder = `/ (root)` → Save
5. After ~30 seconds your app lives at `https://<your-username>.github.io/<repo-name>/`
6. On your iPhone, open that URL in **Safari** → tap the **Share** icon → **Add to Home Screen** → name it "LiftRun" → Add

### Option B — Netlify Drop (no account needed)
1. Go to https://app.netlify.com/drop
2. Drag this entire folder onto the drop zone
3. You'll get a URL like `https://random-name.netlify.app`
4. Open it on iPhone Safari → Share → Add to Home Screen

### Option C — Local network from your PC
1. From this folder, run a local web server. On Windows in PowerShell:
   ```powershell
   # If you have Python:
   python -m http.server 8080
   # Or with Node:
   npx serve .
   ```
2. Find your PC's local IP (e.g. `192.168.1.42`)
3. On iPhone (same Wi-Fi), open Safari to `http://192.168.1.42:8080`
4. Add to Home Screen
5. Caveat: only works while your PC is on the same network and the server is running. Service worker may struggle over plain HTTP — Options A or B are cleaner.

After Add to Home Screen, **launch from the home-screen icon** (not Safari) — this gives you the full-screen, dark, no-browser-chrome experience.

## First-run setup

1. Choose units (kg/km or lb/mi)
2. Pick today or tomorrow as Day 1 (Day 1 = Push)
3. (Optional) Enter your current bodyweight

That's it — Day 1 is ready.

## Enable the AI coach (optional)

1. Get an API key:
   - **Anthropic Claude** (recommended): https://console.anthropic.com/ → API Keys → Create
   - **OpenAI**: https://platform.openai.com/api-keys
2. In the app → **Settings** → AI Coach → paste your key
3. Optionally pin a specific model (defaults: `claude-opus-4-7` for Anthropic, `gpt-4o-mini` for OpenAI). Check current model names in the providers' docs — model lineups change.

Cost for personal use is typically pennies per week. The key is stored in your phone's localStorage, sent only when you message the coach or ask for a suggestion, and nothing is bundled in the app.

## Enable notifications (for the rest timer when backgrounded)

After installing to Home Screen on iOS 16.4+:
1. Launch the app from the home screen icon
2. Settings → Notifications → Enable
3. Tap Allow when iOS asks

## Data export

Settings → Data → Export JSON (full backup) or CSV (just sets). Save these somewhere periodically. If you delete the app, the data goes with it.

## Tech, briefly

- Vanilla JS modules, no build step, no framework
- localStorage for persistence (small footprint; switch to IndexedDB if you outgrow ~5 MB)
- Service worker caches the app shell so it works offline (cache-first, network fallback)
- Charts hand-rolled in SVG — zero dependencies
- Provider-agnostic `CoachService` (`js/coach.js`) — swap Anthropic ↔ OpenAI in Settings; system prompt lives in that file

## Files

```
liftrun-pwa/
├─ index.html              # entry
├─ manifest.json           # PWA manifest
├─ styles.css              # dark-mode-first, mobile-optimized
├─ sw.js                   # service worker (offline)
├─ icons/                  # PNG icons (192/512/180/32 + maskable)
├─ js/
│  ├─ app.js               # entry — router + sheet system + SW registration
│  ├─ util.js              # $/el helpers, format, haptic, toast, parseJsonLoose, e1RM
│  ├─ state.js             # localStorage-backed state + mutators
│  ├─ seed.js              # exercise library + PPL + bro split templates
│  ├─ engine.js            # scheduling + double progression + readiness + plateaus + weekly review
│  ├─ timer.js             # rest timer (circular FAB, notification, wake lock)
│  ├─ coach.js             # CoachService — Anthropic + OpenAI adapters with local fallback
│  ├─ charts.js            # hand-rolled SVG line/bar/calendar
│  └─ screens/             # one render() per screen
│     ├─ onboarding.js
│     ├─ today.js
│     ├─ workout.js        # the most-used screen
│     ├─ exercise.js
│     ├─ program.js
│     ├─ run.js
│     ├─ progress.js
│     ├─ coach.js
│     ├─ body.js
│     ├─ settings.js
│     └─ sheets.js         # readiness, swap, add-exercise sheets
```

## Going native later

When you want HealthKit + Apple Watch + true background GPS, the native scaffold lives in `../liftrun-ios/`. It mirrors the data model 1:1, so you can export JSON here and import on the Mac side.
