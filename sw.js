// Service worker — cache-first app shell + network passthrough for API calls.
const CACHE = 'liftrun-v30';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './styles.css',
  './js/app.js',
  './js/util.js',
  './js/state.js',
  './js/seed.js',
  './js/engine.js',
  './js/timer.js',
  './js/coach.js',
  './js/diet.js',
  './js/charts.js',
  './js/volume.js',
  './js/volume-data.js',
  './js/warmup.js',
  './js/fatigue.js',
  './js/meso.js',
  './js/stress.js',
  './js/race.js',
  './js/platecalc.js',
  './js/nudges.js',
  './js/healthimport.js',
  './js/screens/skipday.js',
  './js/ui.js',
  './js/achievements.js',
  './js/home.js',
  './js/home-data.js',
  './js/screens/equipment.js',
  './js/screens/density.js',
  './js/idb.js',
  './js/ui.js',
  './js/profiles.js',
  './js/backup.js',
  './js/diag.js',
  './js/sync.js',
  './js/screens/account.js',
  './js/screens/about.js',
  './js/readiness.js',
  './js/autoreg.js',
  './js/joint-load.js',
  './js/streak.js',
  './js/periodization.js',
  './js/mobility.js',
  './js/setextras.js',
  './js/screens/elite.js',
  './js/screens/tour.js',
  './js/screens/onboarding.js',
  './js/screens/today.js',
  './js/screens/workout.js',
  './js/screens/exercise.js',
  './js/screens/program.js',
  './js/screens/run.js',
  './js/screens/progress.js',
  './js/screens/coach.js',
  './js/screens/body.js',
  './js/screens/settings.js',
  './js/screens/sheets.js',
  './js/screens/diet.js',
  './js/screens/pain.js',
  './js/screens/platecalc.js',
  './js/screens/quicklog.js',
  './js/screens/formreview.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// Notify clients when a new SW is installed.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  // Don't auto-skip — wait for user confirmation (handled in app.js via "New version available")
  // self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Add files one-by-one so a single 404 doesn't kill the whole install.
    for (const url of SHELL) {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (e) { console.warn('SW cache miss for', url, e.message); }
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Never cache API calls — pass through to network.
  if (url.hostname.endsWith('anthropic.com') ||
      url.hostname.endsWith('openai.com') ||
      url.hostname.endsWith('googleapis.com') ||
      url.hostname.endsWith('groq.com')) return;
  if (req.method !== 'GET') return;

  // Same-origin: cache-first, network fallback, opportunistic update.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const networkFetch = fetch(req).then(res => {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(() => cached || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } }));
      return cached || networkFetch;
    })());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    if (list.length) return list[0].focus();
    return self.clients.openWindow('./');
  }));
});
