// Engine unit tests. Run with: node --test  (from the liftrun-pwa folder)
// A localStorage + minimal DOM shim lets the state-dependent modules import cleanly under Node.
import test from 'node:test';
import assert from 'node:assert/strict';

// ---- Shims so browser-targeted modules import under Node ----
// localStorage isn't built into Node; define it. (navigator already exists in Node 18+.)
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  },
});
const sessionStore = new Map();
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (k) => (sessionStore.has(k) ? sessionStore.get(k) : null),
    setItem: (k, v) => sessionStore.set(k, String(v)),
    removeItem: (k) => sessionStore.delete(k),
    clear: () => sessionStore.clear(),
  },
});

// ---- Pure-math modules (no state) ----
test('platecalc: exact + closest', async () => {
  const pc = await import('../js/platecalc.js');
  assert.equal(pc.plateBreakdown(20, 20).perSidePlates.length, 0, 'empty bar');
  assert.equal(pc.plateBreakdown(60, 20).perSideKg, 20, '60kg → 20/side');
  assert.deepEqual(pc.plateBreakdown(62.5, 20).perSidePlates, [20, 1.25], '62.5 mix');
  assert.equal(pc.plateBreakdown(15, 20).feasible, false, 'below bar infeasible');
  const closest = pc.closestAchievable(58, 20);
  assert.ok(closest.feasible, 'closest achievable feasible');
});

test('race: Riegel + zones + plan', async () => {
  const race = await import('../js/race.js');
  const t10k = race.predictTime(5000, 1500, 10000); // 5k@25:00 → 10k
  assert.ok(t10k > 3000 && t10k < 3300, `10k predict ~52min, got ${Math.round(t10k)}s`);
  assert.equal(race.predictTime(0, 0, 10000), null, 'invalid → null');
  const z = race.hrZones(195, 55);
  assert.ok(z.z2.low < z.z2.high && z.z5.high === 195, 'zones ordered');
  assert.equal(race.hrZones(null), null, 'no maxHR → null');
  const plan = race.buildRacePlan({ distanceMeters: 5000, targetSeconds: 1500, raceDate: new Date(Date.now() + 56 * 864e5).toISOString() });
  assert.ok(plan && plan.weeks >= 4 && plan.phases.length, 'plan built');
  assert.equal(race.buildRacePlan(null), null, 'no race → null');
});

test('readiness: scoring bounds', async () => {
  const r = await import('../js/readiness.js');
  const perfect = r.readinessFromDaily({ sleepHours: 8, sleepQuality: 5, mood: 5, energy: 5, soreness: 1, stress: 1 });
  assert.ok(perfect >= 85, `perfect ≥85, got ${perfect}`);
  const awful = r.readinessFromDaily({ sleepHours: 4, sleepQuality: 1, mood: 1, energy: 1, soreness: 5, stress: 5 });
  assert.ok(awful <= 20, `awful ≤20, got ${awful}`);
  assert.equal(r.readinessFromDaily(null), null, 'null input');
  assert.equal(r.readinessAdvice(90).mode, 'primed');
  assert.equal(r.readinessAdvice(20).mode, 'low');
  assert.equal(r.readinessAdvice(50, true).mode, 'pain', 'pain overrides');
});

test('util: parseJsonLoose + e1RM + formatting', async () => {
  const u = await import('../js/util.js');
  assert.deepEqual(u.parseJsonLoose('{"a":1}'), { a: 1 });
  assert.deepEqual(u.parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 }, 'fenced');
  assert.deepEqual(u.parseJsonLoose('sure: {"a":1} done'), { a: 1 }, 'prose-wrapped');
  assert.deepEqual(u.parseJsonLoose('{"a":1,}'), { a: 1 }, 'trailing comma');
  assert.equal(u.parseJsonLoose('nope'), null);
  assert.equal(Math.round(u.e1RM(100, 5)), 117, 'Epley 100x5');
  assert.equal(u.e1RM(0, 5), 0);
  assert.equal(u.kgToLb(10).toFixed(1), '22.0');
});

test('periodization: dup + block + linear', async () => {
  const p = await import('../js/periodization.js');
  const dup = p.dupForDay(0, { repLow: 8, repHigh: 12 });
  assert.ok(dup.weightMultiplier > 1, 'Monday DUP is heavy');
  const block = p.blockForWeek(1);
  assert.equal(block.phase, 'volume');
  assert.equal(p.blockForWeek(6).phase, 'deload');
});

test('home: ladders + zero-equipment session', async () => {
  const hd = await import('../js/home-data.js');
  // Every ladder references real exercise ids
  for (const [pattern, ids] of Object.entries(hd.LADDERS)) {
    for (const id of ids) assert.ok(hd.HOME_INDEX[id], `ladder ${pattern} → unknown id ${id}`);
  }
  // Every program slot references a known pattern
  for (const prog of Object.values(hd.HOME_PROGRAMS)) {
    for (const day of prog.days) {
      for (const slot of day.slots) {
        const base = slot.pattern.replace(/-ph$/, '').replace('q-bulgarian', 'squat');
        assert.ok(hd.LADDERS[base], `program ${prog.id} → unknown pattern ${slot.pattern}`);
      }
    }
  }
});

test('seed: every program slot references a real exercise', async () => {
  const seed = await import('../js/seed.js');
  for (const prog of Object.values(seed.PROGRAMS)) {
    for (const day of prog.days) {
      for (const slot of (day.slots || [])) {
        assert.ok(seed.EXERCISE_INDEX[slot.exerciseId], `${prog.id}/${day.id} → unknown ${slot.exerciseId}`);
      }
    }
  }
});

test('volume-data: stimulus + landmark integrity', async () => {
  const v = await import('../js/volume-data.js');
  // Every stimulus muscle has a landmark
  for (const [ex, stim] of Object.entries(v.MUSCLE_STIMULUS)) {
    for (const muscle of Object.keys(stim)) {
      assert.ok(v.VOLUME_LANDMARKS[muscle], `${ex} → muscle "${muscle}" has no landmark`);
    }
  }
  // Landmarks ordered mev ≤ mav ≤ mrv
  for (const [m, lm] of Object.entries(v.VOLUME_LANDMARKS)) {
    assert.ok(lm.mev <= lm.mav && lm.mav <= lm.mrv, `${m} landmarks out of order`);
  }
});

test('achievements: all have id/name/check', async () => {
  const a = await import('../js/achievements.js');
  const ids = new Set();
  for (const b of a.BADGES) {
    assert.ok(b.id && b.name && typeof b.check === 'function', `badge malformed: ${JSON.stringify(b)}`);
    assert.ok(!ids.has(b.id), `duplicate badge id ${b.id}`);
    ids.add(b.id);
  }
});

test('profiles: migration, isolation, gate, PIN', async () => {
  const P = await import('../js/profiles.js');
  const S = await import('../js/state.js');
  // Clean slate for profile-related keys.
  store.clear(); sessionStore.clear();

  // ---- Legacy migration: adopt existing single-user data without loss ----
  localStorage.setItem(S.LEGACY_KEY, JSON.stringify({ version: 1, user: { _marker: 'OLD' }, settings: { theme: 'light' } }));
  P.migrateLegacyIfNeeded();
  let reg = P.loadRegistry();
  assert.equal(reg.profiles.length, 1, 'legacy → one profile');
  assert.ok(reg.activeId, 'active id set after migration');
  const meId = reg.profiles[0].id;
  const migrated = JSON.parse(localStorage.getItem(P.stateKeyFor(meId)));
  assert.equal(migrated.user._marker, 'OLD', 'legacy data preserved into profile');
  assert.deepEqual(P.gateState(), { gate: 'ok', id: meId }, 'gate ok after migration');

  // ---- Create a second profile with a different theme; data stays isolated ----
  const bId = await P.createProfile({ name: 'B', theme: 'pink' });
  assert.notEqual(bId, meId, 'new profile id');
  assert.equal(P.activeId(), bId, 'new profile becomes active');
  assert.equal(S.get().settings.theme, 'pink', 'new profile theme applied');
  // Switch back — the first profile is untouched.
  P.activate(meId);
  assert.equal(S.get().user._marker, 'OLD', 'profile A data isolated + intact');
  assert.equal(S.get().settings.theme, 'light', 'profile A theme isolated');
  assert.notEqual(P.stateKeyFor(meId), P.stateKeyFor(bId), 'distinct storage namespaces');

  // ---- PIN ----
  await P.setPin(bId, '1234');
  assert.equal(await P.verifyPin(bId, '1234'), true, 'correct PIN verifies');
  assert.equal(await P.verifyPin(bId, '0000'), false, 'wrong PIN rejected');
  sessionStore.clear();
  assert.equal(P.gateState().gate, 'ok', 'active (A, no PIN) opens without gate');
  P.activate(bId); sessionStore.clear();
  assert.equal(P.gateState().gate, 'pin', 'PIN profile gated on cold start');
});

test('sync: decideApply conflict matrix', async () => {
  const { decideApply } = await import('../js/sync.js');
  // remote newer
  assert.equal(decideApply(5, 3, false), 'apply', 'newer remote, clean local → apply');
  assert.equal(decideApply(5, 3, true), 'conflict', 'newer remote, dirty local → conflict (keep local)');
  // remote same/older
  assert.equal(decideApply(3, 3, true), 'push', 'equal rev, dirty → push');
  assert.equal(decideApply(3, 3, false), 'skip', 'equal rev, clean → skip');
  assert.equal(decideApply(1, 4, true), 'push', 'older remote, dirty → push');
  assert.equal(decideApply(1, 4, false), 'skip', 'older remote, clean → skip');
});
