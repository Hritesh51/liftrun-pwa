// Race pace math + race plan generator.
// Riegel: t2 = t1 × (d2/d1)^1.06 — surprisingly accurate for amateur/intermediate runners.
// Jack Daniels VDOT: more accurate but complex; we use Riegel for prediction + lookup for training paces.

// Predict race time at d2 from a known performance at d1.
export function predictTime(knownDistanceM, knownSeconds, targetDistanceM) {
  if (!knownDistanceM || !knownSeconds || !targetDistanceM) return null;
  return knownSeconds * Math.pow(targetDistanceM / knownDistanceM, 1.06);
}

// Easy / tempo / threshold / interval paces given a recent race or hard effort.
export function trainingPaces(referencePaceSecPerKm) {
  if (!referencePaceSecPerKm) return null;
  return {
    recoverySecPerKm:  referencePaceSecPerKm * 1.30,
    easySecPerKm:      referencePaceSecPerKm * 1.18,
    marathonSecPerKm:  referencePaceSecPerKm * 1.08,
    thresholdSecPerKm: referencePaceSecPerKm * 1.00,
    intervalSecPerKm:  referencePaceSecPerKm * 0.92,
    repsSecPerKm:      referencePaceSecPerKm * 0.85,
  };
}

// Heart rate zones from max HR (Karvonen with resting HR if provided).
export function hrZones(maxHR, restingHR) {
  if (!maxHR) return null;
  const reserve = (pct) => restingHR ? Math.round(restingHR + (maxHR - restingHR) * pct) : Math.round(maxHR * pct);
  return {
    z1: { name: 'Recovery',  low: reserve(0.50), high: reserve(0.60) },
    z2: { name: 'Easy',      low: reserve(0.60), high: reserve(0.70) },
    z3: { name: 'Tempo',     low: reserve(0.70), high: reserve(0.80) },
    z4: { name: 'Threshold', low: reserve(0.80), high: reserve(0.90) },
    z5: { name: 'VO2max',    low: reserve(0.90), high: maxHR },
  };
}

// Build a weekly running plan toward a race date.
// Periodization: base (Z2) → build (Z2 + tempo + intervals) → peak → 1-week taper.
export function buildRacePlan(race, todayISO = new Date().toISOString()) {
  if (!race?.raceDate || !race?.distanceMeters || !race?.targetSeconds) return null;
  const today = new Date(todayISO); today.setHours(0, 0, 0, 0);
  const race_date = new Date(race.raceDate); race_date.setHours(0, 0, 0, 0);
  const daysToRace = Math.round((race_date.getTime() - today.getTime()) / 86400000);
  if (daysToRace <= 0) return null;
  const weeks = Math.max(2, Math.ceil(daysToRace / 7));

  const goalPaceSecPerKm = race.targetSeconds / (race.distanceMeters / 1000);
  const paces = trainingPaces(goalPaceSecPerKm);

  // Phases: base 40%, build 40%, peak 15%, taper 5%.
  const phases = [];
  /** @type {Array<[string, number]>} */
  const phasePlan = weeks <= 6
    ? [['build', Math.ceil(weeks * 0.7)], ['taper', 1]]
    : [['base', Math.floor(weeks * 0.4)], ['build', Math.floor(weeks * 0.4)], ['peak', Math.floor(weeks * 0.15)], ['taper', 1]];
  let consumed = 0;
  for (const [name, n] of phasePlan) {
    for (let i = 0; i < n; i++) {
      const weekNum = consumed + 1;
      phases.push(buildWeek(name, weekNum, weeks, race, paces));
      consumed++;
      if (consumed >= weeks) break;
    }
    if (consumed >= weeks) break;
  }
  return { weeks, paces, phases, goalPaceSecPerKm, daysToRace };
}

function buildWeek(phase, weekNum, totalWeeks, race, paces) {
  const isLong5K = race.distanceMeters >= 5000;
  const longRunKm = phase === 'base' ? 5 + weekNum
                  : phase === 'build' ? 7 + Math.min(8, weekNum)
                  : phase === 'peak'  ? Math.max(8, race.distanceMeters / 1000 * 0.8)
                  : race.distanceMeters / 1000 * 0.5; // taper
  const sessions = [];
  // 1) Easy Z2
  sessions.push({ type: 'easy', label: 'Easy Z2', paceSecPerKm: paces.easySecPerKm, durationMin: 25 + Math.min(20, weekNum * 2) });
  if (phase !== 'taper') {
    // 2) Tempo or intervals
    if (phase === 'base') {
      sessions.push({ type: 'easy', label: 'Easy Z2', paceSecPerKm: paces.easySecPerKm, durationMin: 20 + Math.min(15, weekNum) });
    } else if (phase === 'build') {
      sessions.push({ type: 'tempo', label: '20 min tempo @ threshold', paceSecPerKm: paces.thresholdSecPerKm, durationMin: 35 });
    } else if (phase === 'peak') {
      sessions.push({ type: 'intervals', label: '5 × 1 km @ goal pace, 90s jog', paceSecPerKm: paces.intervalSecPerKm, durationMin: 40 });
    }
  }
  // 3) Long run
  sessions.push({ type: 'long', label: `Long ${Math.round(longRunKm)} km easy`, paceSecPerKm: paces.easySecPerKm, distanceKm: Math.round(longRunKm) });
  return {
    weekNum, phase,
    note: phase === 'taper' ? 'Taper week — short, sharp, well-rested.' : `${phase} block — ${sessions.length} runs.`,
    sessions,
    legLiftIntensity: phase === 'taper' ? 0.6 : phase === 'peak' ? 0.8 : 1.0,
  };
}
