// Apple Health XML import — parses an iOS Health export.xml and ingests:
//  - Recent running workouts → RunActivity
//  - Body mass readings → BodyMetric
//  - Resting heart rate → settings.hrZones.restingHR (latest)
// Skips anything older than the cutoff (default 90 days) to keep parse fast.

import * as S from './state.js';

// Apple Health uses "YYYY-MM-DD HH:MM:SS +HHMM" (with a space, not a T).
// JavaScript Date is inconsistent across browsers for this format — parse it explicitly.
function parseAppleDate(s) {
  if (!s) return NaN;
  // Try native first
  const native = new Date(s).getTime();
  if (!isNaN(native)) return native;
  // Manual: 2024-12-01 06:00:00 +0530
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\s*([+-]\d{2})(\d{2})?)?/);
  if (!m) return NaN;
  const [, Y, Mo, D, H, Mi, Se, tzH, tzM] = m;
  const iso = `${Y}-${Mo}-${D}T${H}:${Mi}:${Se}${tzH ? tzH + ':' + (tzM || '00') : 'Z'}`;
  return new Date(iso).getTime();
}

export async function importHealthXML(fileOrText, { cutoffDays = 90 } = {}) {
  const text = typeof fileOrText === 'string' ? fileOrText : await fileOrText.text();
  const cutoff = Date.now() - cutoffDays * 86400000;
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Not a valid Apple Health export.xml');

  /** @type {{ runs: number, bodyMass: number, restingHR: number|null, skipped: number, errors: string[] }} */
  const result = { runs: 0, bodyMass: 0, restingHR: null, skipped: 0, errors: [] };

  // 1) Running workouts — <Workout workoutActivityType="HKWorkoutActivityTypeRunning" ...>
  const workouts = doc.querySelectorAll('Workout[workoutActivityType="HKWorkoutActivityTypeRunning"]');
  for (const w of workouts) {
    try {
      const start = parseAppleDate(w.getAttribute('startDate'));
      const end = parseAppleDate(w.getAttribute('endDate'));
      if (!isFinite(start) || !isFinite(end)) { result.skipped++; continue; }
      if (start < cutoff) { result.skipped++; continue; }
      const durationSeconds = Math.round((end - start) / 1000);
      // distance: prefer totalDistance attribute (km or mi based on unit)
      const distUnit = w.getAttribute('totalDistanceUnit') || 'mi';
      const distVal = parseFloat(w.getAttribute('totalDistance') || '0');
      const distanceMeters = distUnit === 'km' ? distVal * 1000 : distVal * 1609.344;
      // Avg HR not always present in the workout node; fall back to child <MetadataEntry> or skip.
      // Apple sometimes stores HR in <WorkoutStatistics> elements (newer exports).
      let avgHR = null;
      const stats = w.querySelectorAll('WorkoutStatistics[type="HKQuantityTypeIdentifierHeartRate"]');
      for (const st of stats) {
        const avg = parseFloat(st.getAttribute('average') || '0');
        if (avg > 0) { avgHR = Math.round(avg); break; }
      }
      // Skip duplicates: do we already have a run within 5 min of this start?
      const existing = S.get().runs.find(r => Math.abs(new Date(r.date).getTime() - start) < 5 * 60 * 1000);
      if (existing) { result.skipped++; continue; }
      S.logRun({
        date: new Date(start).toISOString(),
        source: 'healthKit',
        distanceMeters,
        durationSeconds,
        avgHR,
      });
      result.runs++;
    } catch (e) {
      result.errors.push(String(/** @type {any} */ (e)?.message || e));
    }
  }

  // 2) Body mass — <Record type="HKQuantityTypeIdentifierBodyMass" value="63.5" unit="kg" startDate="..."/>
  const massRecords = doc.querySelectorAll('Record[type="HKQuantityTypeIdentifierBodyMass"]');
  // Dedup by date (one per day)
  const seenDays = new Set();
  for (const r of massRecords) {
    try {
      const startStr = r.getAttribute('startDate');
      const start = parseAppleDate(startStr);
      if (!startStr || !isFinite(start) || start < cutoff) continue;
      const dayKey = startStr.slice(0, 10);
      if (seenDays.has(dayKey)) continue;
      seenDays.add(dayKey);
      const unit = (r.getAttribute('unit') || 'kg').toLowerCase();
      const val = parseFloat(r.getAttribute('value') || '0');
      const kg = unit.startsWith('lb') ? val / 2.20462 : val;
      // Skip if we already have a logged weight on that day
      const existing = S.get().body.find(b => b.date.slice(0, 10) === dayKey);
      if (existing) continue;
      S.logBody({ weightKg: kg, date: new Date(start).toISOString() });
      result.bodyMass++;
    } catch (e) {
      result.errors.push(String(/** @type {any} */ (e)?.message || e));
    }
  }

  // 3) Resting heart rate — take the most recent
  const hrRecords = doc.querySelectorAll('Record[type="HKQuantityTypeIdentifierRestingHeartRate"]');
  let latestHR = null, latestHRTime = 0;
  for (const r of hrRecords) {
    const t = parseAppleDate(r.getAttribute('startDate'));
    if (isFinite(t) && t > latestHRTime) {
      latestHRTime = t;
      latestHR = parseFloat(r.getAttribute('value') || '0');
    }
  }
  if (latestHR && latestHR > 0) {
    S.setHRZones({ restingHR: Math.round(latestHR) });
    result.restingHR = Math.round(latestHR);
  }

  return result;
}
