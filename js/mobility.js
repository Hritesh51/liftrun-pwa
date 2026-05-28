// Daily 5-minute mobility/prehab routine, targeted at the user's flagged weak links
// from the movement screen. Hand-curated drills per joint/region.

const DRILLS = {
  'overhead-mobility': [
    { name: 'Wall slides', cue: 'Back against the wall, slide arms overhead. Forearms stay touching.', durationSec: 60 },
    { name: 'Thoracic extension on roller', cue: 'Foam roller across mid-back, arms behind head, breathe into the stretch.', durationSec: 90 },
    { name: 'Banded shoulder dislocates', cue: 'Light band, arms straight, pass overhead front-to-back smoothly.', durationSec: 60 },
  ],
  'hip-mobility': [
    { name: '90/90 hip stretch', cue: 'Front leg 90°, back leg 90°. Sit upright. Switch.', durationSec: 90 },
    { name: 'Couch stretch', cue: 'Back foot on couch, front leg lunge. Squeeze the back glute.', durationSec: 60 },
    { name: 'Hip airplanes', cue: 'Single-leg, hinge forward, rotate hip open and closed.', durationSec: 60 },
  ],
  'ankle-dorsiflexion': [
    { name: 'Knee-to-wall', cue: 'Front foot 4" from wall, drive knee toward wall without lifting heel.', durationSec: 60 },
    { name: 'Calf stretch (gastroc + soleus)', cue: 'Wall push, back leg straight (gastroc), then bent (soleus).', durationSec: 90 },
  ],
  'single-leg-balance': [
    { name: 'Single-leg stance, eyes closed', cue: 'Stand on one foot, close eyes, 30s each side.', durationSec: 60 },
    { name: 'Single-leg deadlift (no weight)', cue: 'Hinge at hip, reach back leg straight behind. Touch fingers to floor.', durationSec: 60 },
  ],
  'tspine-mobility': [
    { name: 'Cat-cow', cue: 'Round, then arch. Move slow. 10 reps.', durationSec: 60 },
    { name: 'Thread the needle', cue: 'Quadruped, reach one arm under the other, rotate. 10 each.', durationSec: 90 },
  ],
  general: [
    { name: 'Cat-cow', cue: 'Round, then arch. Move slow. 10 reps.', durationSec: 45 },
    { name: 'World\'s greatest stretch', cue: 'Low lunge, reach the same-side arm to ceiling, twist. 5 each.', durationSec: 90 },
    { name: 'Bear crawl', cue: '20 steps forward, 20 back. Knees just off the floor.', durationSec: 60 },
  ],
};

// Map a movement-screen weak-link to a drill set.
export function drillsForWeakLinks(weakLinks = []) {
  if (!weakLinks.length) return DRILLS.general;
  const seen = new Set();
  const out = [];
  for (const w of weakLinks) {
    const set = DRILLS[w] || [];
    for (const d of set) {
      const k = d.name;
      if (!seen.has(k)) { seen.add(k); out.push(d); }
    }
  }
  return out.length ? out.slice(0, 5) : DRILLS.general;
}

// Score the movement screen → weak link list (the score on each test is 1-5; <=3 means flag).
export function weakLinksFrom(screen) {
  if (!screen) return [];
  const links = [];
  if ((screen.shoulderReach ?? 5) <= 3) links.push('overhead-mobility', 'tspine-mobility');
  if ((screen.overheadSquat ?? 5) <= 3) links.push('ankle-dorsiflexion', 'hip-mobility', 'tspine-mobility');
  if ((screen.singleLegBalance ?? 5) <= 3) links.push('single-leg-balance');
  if ((screen.ankleDorsi ?? 5) <= 3) links.push('ankle-dorsiflexion');
  if ((screen.hipMobility ?? 5) <= 3) links.push('hip-mobility');
  return Array.from(new Set(links));
}
