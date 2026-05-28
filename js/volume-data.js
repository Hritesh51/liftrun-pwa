// MEV / MAV / MRV per muscle for a beginner → novice lifter (Israetel-style landmarks, conservative).
// All in "fractional sets per week". User can override in Settings.
export const VOLUME_LANDMARKS = {
  chest:       { mev: 8,  mav: 14, mrv: 20 },
  lats:        { mev: 8,  mav: 14, mrv: 22 },
  'mid-back':  { mev: 8,  mav: 14, mrv: 22 },
  shoulders:   { mev: 6,  mav: 14, mrv: 22 },
  'rear-delts':{ mev: 4,  mav: 10, mrv: 18 },
  traps:       { mev: 0,  mav: 8,  mrv: 14 },
  biceps:      { mev: 6,  mav: 14, mrv: 20 },
  triceps:     { mev: 6,  mav: 14, mrv: 20 },
  forearms:    { mev: 0,  mav: 6,  mrv: 12 },
  quads:       { mev: 8,  mav: 14, mrv: 20 },
  hamstrings:  { mev: 6,  mav: 12, mrv: 18 },
  glutes:      { mev: 4,  mav: 10, mrv: 16 },
  calves:      { mev: 6,  mav: 14, mrv: 18 },
  core:        { mev: 0,  mav: 12, mrv: 20 },
  'low-back':  { mev: 0,  mav: 6,  mrv: 12 },
};

// Stimulus weights per exercise: how much each set "counts" toward each muscle.
// Primary = 1.0, strong synergist = 0.5, mild involvement = 0.3.
// Working sets are summed: total[muscle] += weight × workingSetCount.
export const MUSCLE_STIMULUS = {
  'chest-press':           { chest: 1.0, triceps: 0.5, shoulders: 0.3 },
  'incline-db-press':      { chest: 1.0, shoulders: 0.4, triceps: 0.4 },
  'machine-shoulder-press':{ shoulders: 1.0, triceps: 0.5, chest: 0.2 },
  'lateral-raise':         { shoulders: 1.0 },
  'tri-pushdown':          { triceps: 1.0 },
  'overhead-tri':          { triceps: 1.0 },
  'dips':                  { chest: 0.7, triceps: 0.8, shoulders: 0.4 },
  'cable-fly':             { chest: 1.0 },
  'lat-pulldown':          { lats: 1.0, biceps: 0.5, 'mid-back': 0.3 },
  'seated-row':            { 'mid-back': 1.0, lats: 0.5, biceps: 0.4 },
  'chest-supported-row':   { 'mid-back': 1.0, lats: 0.5, biceps: 0.4 },
  'face-pull':             { 'rear-delts': 1.0, traps: 0.3 },
  'biceps-curl':           { biceps: 1.0 },
  'hammer-curl':           { biceps: 1.0, forearms: 0.5 },
  'pullover':              { lats: 0.8, chest: 0.4 },
  'leg-press':             { quads: 1.0, glutes: 0.5, hamstrings: 0.3 },
  'goblet-squat':          { quads: 1.0, glutes: 0.6, core: 0.4 },
  'rdl':                   { hamstrings: 1.0, glutes: 0.7, 'low-back': 0.4 },
  'leg-extension':         { quads: 1.0 },
  'leg-curl':              { hamstrings: 1.0 },
  'calf-raise':            { calves: 1.0 },
  'ohp':                   { shoulders: 1.0, triceps: 0.5, core: 0.3 },
  'rear-delt-fly':         { 'rear-delts': 1.0 },
  'shrug':                 { traps: 1.0 },
  'plank':                 { core: 1.0 },
  'hanging-knee-raise':    { core: 1.0 },
  'cable-crunch':          { core: 1.0 },
};

// Bodyweight fallback per exercise (when no gym is available).
export const BODYWEIGHT_SUBS = {
  'chest-press':     { name: 'Push-up', cues: ['Hands shoulder-width, hard plank.', 'Lower controlled, full ROM.'] },
  'incline-db-press':{ name: 'Decline Push-up (feet elevated)', cues: ['Feet on bed/chair.', 'Same plank rules.'] },
  'machine-shoulder-press': { name: 'Pike Push-up', cues: ['Hips high, head between hands.', 'Press up vertically.'] },
  'lateral-raise':   { name: 'Water-bottle Lateral Raise', cues: ['Use a full bottle in each hand.', 'Slow controlled raises.'] },
  'tri-pushdown':    { name: 'Bench Dip', cues: ['Feet on the floor, knees bent.', 'Elbows back, not flared.'] },
  'overhead-tri':    { name: 'Diamond Push-up', cues: ['Hands form a triangle under chest.', 'Elbows tucked.'] },
  'lat-pulldown':    { name: 'Doorway Row', cues: ['Towel through door handle, lean back.', 'Pull chest to hands.'] },
  'seated-row':      { name: 'Inverted Row (under a table)', cues: ['Chest to edge, body straight.', 'Pull until chest to edge.'] },
  'chest-supported-row': { name: 'Inverted Row', cues: ['Same as above.', 'Squeeze shoulder blades.'] },
  'biceps-curl':     { name: 'Towel Curl (isometric)', cues: ['Pull a fixed towel against itself.', '30s holds.'] },
  'leg-press':       { name: 'Bulgarian Split Squat', cues: ['Rear foot on a chair.', 'Front knee tracks toes.'] },
  'goblet-squat':    { name: 'Bodyweight Squat', cues: ['Chest up, knees out.', 'Below parallel if mobile.'] },
  'rdl':             { name: 'Single-leg RDL', cues: ['Hinge at the hip.', 'Reach back leg straight.'] },
  'leg-extension':   { name: 'Sissy Squat', cues: ['Lean back, drive knees forward.', 'Hold for support.'] },
  'leg-curl':        { name: 'Nordic Curl (assisted)', cues: ['Feet locked, lower slowly.', 'Push back up with hands if needed.'] },
  'calf-raise':      { name: 'Single-leg Calf Raise', cues: ['Step edge, full stretch.', 'Drive to top of toes.'] },
};
