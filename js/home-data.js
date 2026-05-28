// Home bodybuilding system: equipment, exercise difficulty ladders, and home program templates.
// Hypertrophy at home is driven by progressing UP a difficulty ladder (leverage, ROM, unilateral),
// not by adding plates. Each pattern has an ordered ladder; the engine moves you up when you cap reps.

const FX = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises';
const img = (folder) => `${FX}/${folder}/0.jpg`;

// ---- Equipment the user might own ----
export const EQUIPMENT = [
  { id: 'bodyweight',  label: 'Bodyweight only', always: true },
  { id: 'bands',       label: 'Resistance bands' },
  { id: 'dumbbells',   label: 'Dumbbells' },
  { id: 'pullup-bar',  label: 'Pull-up bar' },
  { id: 'dip-station', label: 'Dip bars / parallettes' },
  { id: 'bench',       label: 'Bench (flat/adjustable)' },
  { id: 'kettlebell',  label: 'Kettlebell' },
  { id: 'chair',       label: 'Chair / sturdy surface', always: true },
  { id: 'vest',        label: 'Weighted vest / backpack' },
];

// ---- Home exercise library ----
// level = relative difficulty within its pattern (1 easiest). equipment = required gear.
export const HOME_EXERCISES = [
  // ===== HORIZONTAL PUSH (chest) =====
  { id: 'h-wall-pushup',     name: 'Wall Push-up',          pattern: 'h-push', primary: 'chest', secondary: ['triceps','shoulders'], equipment: ['bodyweight'], level: 1, loadType: 'reps', imageUrl: img('Pushups'),
    cues: ['Hands on wall at shoulder height.', 'Body in a straight line, brace core.', 'Control the lower, full push.'] },
  { id: 'h-incline-pushup',  name: 'Incline Push-up (on chair)', pattern: 'h-push', primary: 'chest', secondary: ['triceps','shoulders'], equipment: ['chair'], level: 2, loadType: 'reps', imageUrl: img('Incline_Push-Up'),
    cues: ['Hands on a chair/sofa edge.', 'Lower chest to the edge.', 'Squeeze chest to push up.'] },
  { id: 'h-knee-pushup',     name: 'Knee Push-up',          pattern: 'h-push', primary: 'chest', secondary: ['triceps','shoulders'], equipment: ['bodyweight'], level: 3, loadType: 'reps', imageUrl: img('Pushups'),
    cues: ['Knees down, hips straight (no piking).', 'Chest to floor.', 'Full lockout.'] },
  { id: 'h-pushup',          name: 'Push-up',               pattern: 'h-push', primary: 'chest', secondary: ['triceps','shoulders'], equipment: ['bodyweight'], level: 4, loadType: 'bodyweight+', imageUrl: img('Pushups'),
    cues: ['Hard plank, elbows ~45°.', 'Chest to floor, full ROM.', 'Drive the floor away.'] },
  { id: 'h-decline-pushup',  name: 'Feet-Elevated Push-up', pattern: 'h-push', primary: 'chest', secondary: ['triceps','shoulders'], equipment: ['chair'], level: 5, loadType: 'reps', imageUrl: img('Decline_Push-Up'),
    cues: ['Feet on chair, more upper-chest + shoulder.', 'Keep core tight, no sag.', 'Full depth.'] },
  { id: 'h-diamond-pushup',  name: 'Diamond Push-up',       pattern: 'h-push', primary: 'chest', secondary: ['triceps'], equipment: ['bodyweight'], level: 6, loadType: 'reps', imageUrl: img('Push-Ups_-_Close_Triceps_Position'),
    cues: ['Hands form a diamond under chest.', 'Elbows tucked.', 'Big triceps + inner chest.'] },
  { id: 'h-archer-pushup',   name: 'Archer Push-up',        pattern: 'h-push', primary: 'chest', secondary: ['triceps'], equipment: ['bodyweight'], level: 7, loadType: 'reps', imageUrl: img('Pushups'),
    cues: ['Wide hands; shift weight to one arm.', 'Other arm stays straight as support.', 'Alternate sides each rep.'] },
  { id: 'h-onearm-pushup',   name: 'One-Arm Push-up (progression)', pattern: 'h-push', primary: 'chest', secondary: ['triceps'], equipment: ['bodyweight'], level: 8, loadType: 'reps', imageUrl: img('Pushups'),
    cues: ['Feet wide for balance.', 'Lower under control on one arm.', 'Build with elevated reps first.'] },
  // Dumbbell / band alternatives (parallel track)
  { id: 'h-db-floor-press',  name: 'DB Floor Press',        pattern: 'h-push', primary: 'chest', secondary: ['triceps','shoulders'], equipment: ['dumbbells'], level: 4, loadType: 'load', imageUrl: img('Floor_Press'),
    cues: ['Lie on floor, DBs over chest.', 'Elbows touch floor, pause.', 'Press up, squeeze.'] },
  { id: 'h-db-bench-press',  name: 'DB Bench Press',        pattern: 'h-push', primary: 'chest', secondary: ['triceps','shoulders'], equipment: ['dumbbells','bench'], level: 5, loadType: 'load', imageUrl: img('Dumbbell_Bench_Press'),
    cues: ['Bench flat/incline.', 'Full stretch, press together.', 'Control the negative.'] },
  { id: 'h-band-press',      name: 'Band Chest Press',      pattern: 'h-push', primary: 'chest', secondary: ['triceps','shoulders'], equipment: ['bands'], level: 3, loadType: 'reps', imageUrl: img('Pushups'),
    cues: ['Band behind back, press forward.', 'Meet hands in front.', 'Slow return for tension.'] },

  // ===== HORIZONTAL PULL (back) =====
  { id: 'p-doorway-row',     name: 'Doorway Row',           pattern: 'h-pull', primary: 'mid-back', secondary: ['lats','biceps'], equipment: ['bodyweight'], level: 1, loadType: 'reps', imageUrl: img('Inverted_Row'),
    cues: ['Grab a sturdy door frame, lean back.', 'Pull chest toward the frame.', 'Squeeze shoulder blades.'] },
  { id: 'p-table-row',       name: 'Table Inverted Row',    pattern: 'h-pull', primary: 'mid-back', secondary: ['lats','biceps'], equipment: ['bodyweight'], level: 3, loadType: 'reps', imageUrl: img('Inverted_Row'),
    cues: ['Under a sturdy table, grip the edge.', 'Body straight, pull chest to edge.', 'Control down.'] },
  { id: 'p-inverted-row',    name: 'Inverted Row (bar)',    pattern: 'h-pull', primary: 'mid-back', secondary: ['lats','biceps'], equipment: ['pullup-bar'], level: 4, loadType: 'reps', imageUrl: img('Inverted_Row'),
    cues: ['Bar at hip height, hang underneath.', 'Pull chest to bar, elbows back.', 'Full hang stretch.'] },
  { id: 'p-feet-up-row',     name: 'Feet-Elevated Inverted Row', pattern: 'h-pull', primary: 'mid-back', secondary: ['lats','biceps'], equipment: ['pullup-bar','chair'], level: 5, loadType: 'reps', imageUrl: img('Inverted_Row'),
    cues: ['Feet on a chair — harder leverage.', 'Pull to sternum.', 'Pause at the top.'] },
  { id: 'p-archer-row',      name: 'Archer Inverted Row',   pattern: 'h-pull', primary: 'mid-back', secondary: ['lats','biceps'], equipment: ['pullup-bar'], level: 6, loadType: 'reps', imageUrl: img('Inverted_Row'),
    cues: ['Shift weight to one arm.', 'Other arm assists.', 'Alternate sides.'] },
  { id: 'p-db-row',          name: 'DB Row',                pattern: 'h-pull', primary: 'mid-back', secondary: ['lats','biceps'], equipment: ['dumbbells'], level: 4, loadType: 'load', imageUrl: img('Bent_Over_Two-Dumbbell_Row'),
    cues: ['Hinge, flat back.', 'Row to hip, squeeze.', 'Slow eccentric.'] },
  { id: 'p-band-row',        name: 'Band Row',              pattern: 'h-pull', primary: 'mid-back', secondary: ['lats','biceps'], equipment: ['bands'], level: 2, loadType: 'reps', imageUrl: img('Bent_Over_Two-Dumbbell_Row'),
    cues: ['Anchor band at chest height.', 'Row elbows back, squeeze blades.', 'Control return.'] },

  // ===== VERTICAL PULL (lats) =====
  { id: 'v-band-pulldown',   name: 'Band Pulldown',         pattern: 'v-pull', primary: 'lats', secondary: ['biceps'], equipment: ['bands'], level: 2, loadType: 'reps', imageUrl: img('Wide-Grip_Lat_Pulldown'),
    cues: ['Anchor band overhead.', 'Pull elbows down to ribs.', 'Feel the lats.'] },
  { id: 'v-neg-pullup',      name: 'Negative Pull-up',      pattern: 'v-pull', primary: 'lats', secondary: ['biceps'], equipment: ['pullup-bar'], level: 4, loadType: 'reps', imageUrl: img('Pullups'),
    cues: ['Jump to the top position.', 'Lower as slowly as possible (5s+).', 'Builds the strength for full reps.'] },
  { id: 'v-band-pullup',     name: 'Band-Assisted Pull-up', pattern: 'v-pull', primary: 'lats', secondary: ['biceps'], equipment: ['pullup-bar','bands'], level: 5, loadType: 'reps', imageUrl: img('Pullups'),
    cues: ['Loop band on bar, foot in band.', 'Pull chin over bar.', 'Less band as you get stronger.'] },
  { id: 'v-pullup',          name: 'Pull-up',               pattern: 'v-pull', primary: 'lats', secondary: ['biceps'], equipment: ['pullup-bar'], level: 6, loadType: 'bodyweight+', imageUrl: img('Pullups'),
    cues: ['Full dead hang.', 'Chin over bar, chest up.', 'Control the descent.'] },
  { id: 'v-archer-pullup',   name: 'Archer Pull-up',        pattern: 'v-pull', primary: 'lats', secondary: ['biceps'], equipment: ['pullup-bar'], level: 7, loadType: 'reps', imageUrl: img('Pullups'),
    cues: ['Pull toward one hand, other arm straight.', 'Alternate sides.', 'Path to one-arm.'] },

  // ===== VERTICAL PUSH (shoulders) =====
  { id: 's-pike-pushup',     name: 'Pike Push-up',          pattern: 'v-push', primary: 'shoulders', secondary: ['triceps'], equipment: ['bodyweight'], level: 3, loadType: 'reps', imageUrl: img('Handstand_Push-Ups'),
    cues: ['Hips high (inverted V).', 'Head toward floor between hands.', 'Press straight up.'] },
  { id: 's-elev-pike',       name: 'Elevated Pike Push-up', pattern: 'v-push', primary: 'shoulders', secondary: ['triceps'], equipment: ['chair'], level: 5, loadType: 'reps', imageUrl: img('Handstand_Push-Ups'),
    cues: ['Feet on chair, near-vertical torso.', 'Deeper ROM = more shoulder.', 'Control descent.'] },
  { id: 's-wall-hspu',       name: 'Wall Handstand Push-up', pattern: 'v-push', primary: 'shoulders', secondary: ['triceps'], equipment: ['bodyweight'], level: 7, loadType: 'reps', imageUrl: img('Handstand_Push-Ups'),
    cues: ['Kick up to wall, controlled.', 'Lower head toward floor.', 'Press to lockout.'] },
  { id: 's-db-press',        name: 'DB Shoulder Press',     pattern: 'v-push', primary: 'shoulders', secondary: ['triceps'], equipment: ['dumbbells'], level: 4, loadType: 'load', imageUrl: img('Dumbbell_Shoulder_Press'),
    cues: ['Press overhead, full lockout.', 'Brace core, no arch.', 'Lower slowly.'] },
  { id: 's-band-press',      name: 'Band Overhead Press',   pattern: 'v-push', primary: 'shoulders', secondary: ['triceps'], equipment: ['bands'], level: 2, loadType: 'reps', imageUrl: img('Dumbbell_Shoulder_Press'),
    cues: ['Stand on band, press overhead.', 'Full lockout.', 'Slow negative.'] },
  { id: 's-band-lateral',    name: 'Band Lateral Raise',    pattern: 'side-delt', primary: 'shoulders', secondary: [], equipment: ['bands'], level: 2, loadType: 'reps', imageUrl: img('Side_Lateral_Raise'),
    cues: ['Stand on band, raise to shoulder height.', 'Lead with elbow.', 'Slow down.'] },
  { id: 's-db-lateral',      name: 'DB Lateral Raise',      pattern: 'side-delt', primary: 'shoulders', secondary: [], equipment: ['dumbbells'], level: 3, loadType: 'load', imageUrl: img('Side_Lateral_Raise'),
    cues: ['Slight lean, lead with elbow.', 'Pause at top.', 'Slow eccentric.'] },

  // ===== SQUAT (quads) =====
  { id: 'q-assisted-squat',  name: 'Assisted Squat',        pattern: 'squat', primary: 'quads', secondary: ['glutes'], equipment: ['chair'], level: 1, loadType: 'reps', imageUrl: img('Bodyweight_Squat'),
    cues: ['Hold a door frame for balance.', 'Sit back to a chair, stand up.', 'Knees track over toes.'] },
  { id: 'q-bw-squat',        name: 'Bodyweight Squat',      pattern: 'squat', primary: 'quads', secondary: ['glutes'], equipment: ['bodyweight'], level: 2, loadType: 'reps', imageUrl: img('Bodyweight_Squat'),
    cues: ['Feet shoulder-width.', 'Sit between heels, chest up.', 'Below parallel if mobile.'] },
  { id: 'q-tempo-squat',     name: 'Tempo Squat (3s down)', pattern: 'squat', primary: 'quads', secondary: ['glutes'], equipment: ['bodyweight'], level: 3, loadType: 'reps', imageUrl: img('Bodyweight_Squat'),
    cues: ['3-second descent, 1s pause.', 'Stand with control.', 'Time under tension builds size.'] },
  { id: 'q-split-squat',     name: 'Split Squat',           pattern: 'squat', primary: 'quads', secondary: ['glutes'], equipment: ['bodyweight'], level: 4, loadType: 'reps', imageUrl: img('Dumbbell_Lunges'),
    cues: ['Staggered stance, drop straight down.', 'Front knee over mid-foot.', 'Both legs equal.'] },
  { id: 'q-bulgarian',       name: 'Bulgarian Split Squat',  pattern: 'squat', primary: 'quads', secondary: ['glutes'], equipment: ['chair'], level: 5, loadType: 'bodyweight+', imageUrl: img('Dumbbell_Lunges'),
    cues: ['Rear foot on chair.', 'Drop the back knee, stay tall.', 'Brutal — the home squat king.'] },
  { id: 'q-pistol-prog',     name: 'Pistol Squat (assisted)', pattern: 'squat', primary: 'quads', secondary: ['glutes'], equipment: ['chair'], level: 6, loadType: 'reps', imageUrl: img('Bodyweight_Squat'),
    cues: ['Hold support, squat on one leg.', 'Other leg extended forward.', 'Build to unassisted.'] },
  { id: 'q-pistol',          name: 'Pistol Squat',          pattern: 'squat', primary: 'quads', secondary: ['glutes'], equipment: ['bodyweight'], level: 7, loadType: 'reps', imageUrl: img('Bodyweight_Squat'),
    cues: ['Full single-leg squat, no support.', 'Control all the way down.', 'Elite home leg builder.'] },
  { id: 'q-goblet-squat',    name: 'Goblet Squat',          pattern: 'squat', primary: 'quads', secondary: ['glutes'], equipment: ['dumbbells'], level: 4, loadType: 'load', imageUrl: img('Goblet_Squat'),
    cues: ['Hold DB/KB at chest.', 'Sit deep, chest up.', 'Drive through heels.'] },

  // ===== HINGE (hamstrings/glutes) =====
  { id: 'hi-glute-bridge',   name: 'Glute Bridge',          pattern: 'hinge', primary: 'glutes', secondary: ['hamstrings'], equipment: ['bodyweight'], level: 1, loadType: 'reps', imageUrl: img('Butt_Lift_Bridge'),
    cues: ['Lie down, drive hips up.', 'Squeeze glutes hard at top.', 'Pause 1s.'] },
  { id: 'hi-sl-bridge',      name: 'Single-Leg Glute Bridge', pattern: 'hinge', primary: 'glutes', secondary: ['hamstrings'], equipment: ['bodyweight'], level: 3, loadType: 'reps', imageUrl: img('Single_Leg_Glute_Bridge'),
    cues: ['One foot down, other leg up.', 'Drive through the heel.', 'Squeeze, don\'t arch the back.'] },
  { id: 'hi-hip-thrust',     name: 'Hip Thrust (on chair)',  pattern: 'hinge', primary: 'glutes', secondary: ['hamstrings'], equipment: ['chair'], level: 4, loadType: 'bodyweight+', imageUrl: img('Barbell_Hip_Thrust'),
    cues: ['Upper back on chair edge.', 'Drive hips to full extension.', 'Add a backpack for load.'] },
  { id: 'hi-nordic-neg',     name: 'Nordic Curl Negative',  pattern: 'hinge', primary: 'hamstrings', secondary: ['glutes'], equipment: ['bodyweight'], level: 6, loadType: 'reps', imageUrl: img('Floor_Glute-Ham_Raise'),
    cues: ['Anchor feet (under sofa).', 'Lower torso slowly, resist with hams.', 'Push back up with hands.'] },
  { id: 'hi-sl-rdl',         name: 'Single-Leg RDL',        pattern: 'hinge', primary: 'hamstrings', secondary: ['glutes'], equipment: ['bodyweight'], level: 4, loadType: 'bodyweight+', imageUrl: img('Romanian_Deadlift'),
    cues: ['Hinge at hip, reach back leg.', 'Flat back, feel the hamstring.', 'Add DB/backpack to load.'] },
  { id: 'hi-band-rdl',       name: 'Band RDL',              pattern: 'hinge', primary: 'hamstrings', secondary: ['glutes'], equipment: ['bands'], level: 3, loadType: 'reps', imageUrl: img('Romanian_Deadlift'),
    cues: ['Stand on band, hinge hips back.', 'Stretch the hamstrings.', 'Drive hips forward.'] },

  // ===== CALVES =====
  { id: 'c-calf-raise',      name: 'Calf Raise',            pattern: 'calf', primary: 'calves', secondary: [], equipment: ['bodyweight'], level: 1, loadType: 'reps', imageUrl: img('Standing_Calf_Raises'),
    cues: ['Up on toes, full height.', 'Pause 1s at top.', 'Slow descent.'] },
  { id: 'c-sl-calf-raise',   name: 'Single-Leg Calf Raise', pattern: 'calf', primary: 'calves', secondary: [], equipment: ['chair'], level: 3, loadType: 'reps', imageUrl: img('Standing_Calf_Raises'),
    cues: ['On a step edge for full stretch.', 'One leg, full ROM.', 'Hold for balance.'] },

  // ===== ARMS =====
  { id: 'a-bench-dip',       name: 'Bench Dip',             pattern: 'triceps', primary: 'triceps', secondary: ['chest','shoulders'], equipment: ['chair'], level: 2, loadType: 'reps', imageUrl: img('Bench_Dips'),
    cues: ['Hands on chair behind you.', 'Lower until elbows ~90°.', 'Press up, squeeze triceps.'] },
  { id: 'a-dip',             name: 'Parallel Bar Dip',      pattern: 'triceps', primary: 'triceps', secondary: ['chest','shoulders'], equipment: ['dip-station'], level: 5, loadType: 'bodyweight+', imageUrl: img('Dips_-_Triceps_Version'),
    cues: ['Slight forward lean.', 'Lower to ~90°.', 'Lockout at top.'] },
  { id: 'a-band-pushdown',   name: 'Band Triceps Pushdown', pattern: 'triceps', primary: 'triceps', secondary: [], equipment: ['bands'], level: 2, loadType: 'reps', imageUrl: img('Triceps_Pushdown'),
    cues: ['Anchor band high.', 'Elbows pinned, extend down.', 'Squeeze at bottom.'] },
  { id: 'a-db-curl',         name: 'DB Biceps Curl',        pattern: 'biceps', primary: 'biceps', secondary: ['forearms'], equipment: ['dumbbells'], level: 3, loadType: 'load', imageUrl: img('Dumbbell_Bicep_Curl'),
    cues: ['Elbows by sides.', 'Curl with control, supinate.', 'Full stretch at bottom.'] },
  { id: 'a-band-curl',       name: 'Band Biceps Curl',      pattern: 'biceps', primary: 'biceps', secondary: ['forearms'], equipment: ['bands'], level: 2, loadType: 'reps', imageUrl: img('Dumbbell_Bicep_Curl'),
    cues: ['Stand on band, curl up.', 'Elbows stay still.', 'Slow negative.'] },
  { id: 'a-chinup',          name: 'Chin-up',               pattern: 'biceps', primary: 'biceps', secondary: ['lats'], equipment: ['pullup-bar'], level: 5, loadType: 'bodyweight+', imageUrl: img('Chin-Up'),
    cues: ['Underhand grip, pull chin over.', 'Big biceps + lats.', 'Control down.'] },

  // ===== CORE =====
  { id: 'co-plank',          name: 'Plank',                 pattern: 'core', primary: 'core', secondary: [], equipment: ['bodyweight'], level: 1, loadType: 'time', imageUrl: img('Plank'),
    cues: ['Elbows under shoulders.', 'Glutes + abs tight, straight line.', 'Breathe.'] },
  { id: 'co-hollow',         name: 'Hollow Body Hold',      pattern: 'core', primary: 'core', secondary: [], equipment: ['bodyweight'], level: 3, loadType: 'time', imageUrl: img('Plank'),
    cues: ['Lower back pressed to floor.', 'Legs + arms extended, off floor.', 'Hold the dish shape.'] },
  { id: 'co-hang-knee',      name: 'Hanging Knee Raise',    pattern: 'core', primary: 'core', secondary: [], equipment: ['pullup-bar'], level: 4, loadType: 'reps', imageUrl: img('Hanging_Leg_Raise'),
    cues: ['Hang, tilt pelvis up.', 'Knees to chest, slow down.', 'No swinging.'] },
  { id: 'co-hang-leg',       name: 'Hanging Leg Raise',     pattern: 'core', primary: 'core', secondary: [], equipment: ['pullup-bar'], level: 6, loadType: 'reps', imageUrl: img('Hanging_Leg_Raise'),
    cues: ['Straight legs to horizontal+.', 'Control the lower.', 'Brutal lower-ab work.'] },
];

export const HOME_INDEX = Object.fromEntries(HOME_EXERCISES.map(e => [e.id, e]));

// ---- Progression ladders per pattern (ordered easiest → hardest) ----
// The engine moves UP the ladder when reps are capped across all sets.
export const LADDERS = {
  'h-push':    ['h-wall-pushup', 'h-incline-pushup', 'h-knee-pushup', 'h-pushup', 'h-decline-pushup', 'h-diamond-pushup', 'h-archer-pushup', 'h-onearm-pushup'],
  'h-push-db': ['h-band-press', 'h-db-floor-press', 'h-db-bench-press'],
  'h-pull':    ['p-doorway-row', 'p-band-row', 'p-table-row', 'p-inverted-row', 'p-feet-up-row', 'p-archer-row'],
  'v-pull':    ['v-band-pulldown', 'v-neg-pullup', 'v-band-pullup', 'v-pullup', 'v-archer-pullup'],
  'v-push':    ['s-band-press', 's-pike-pushup', 's-db-press', 's-elev-pike', 's-wall-hspu'],
  'side-delt': ['s-band-lateral', 's-db-lateral'],
  'squat':     ['q-assisted-squat', 'q-bw-squat', 'q-tempo-squat', 'q-goblet-squat', 'q-split-squat', 'q-bulgarian', 'q-pistol-prog', 'q-pistol'],
  'hinge':     ['hi-glute-bridge', 'hi-band-rdl', 'hi-sl-bridge', 'hi-hip-thrust', 'hi-sl-rdl', 'hi-nordic-neg'],
  'calf':      ['c-calf-raise', 'c-sl-calf-raise'],
  'triceps':   ['a-band-pushdown', 'a-bench-dip', 'a-dip'],
  'biceps':    ['a-band-curl', 'a-db-curl', 'a-chinup'],
  'core':      ['co-plank', 'co-hollow', 'co-hang-knee', 'co-hang-leg'],
};

// ---- Home program templates ----
// Built around movement PATTERNS — the engine fills each slot with the best available exercise
// at the user's current ladder position given their equipment.
const slot = (pattern, sets, repLow, repHigh, restSec = 75) => ({ pattern, sets, repLow, repHigh, restSec });

export const HOME_PROGRAMS = {
  // Full Body ×3 — best for home beginners with minimal equipment
  HOME_FB: {
    id: 'HOME_FB', name: 'Full Body ×3',
    days: [
      { id: 'fb-1', name: 'Full Body A', slots: [
        slot('squat', 3, 8, 15), slot('h-push', 3, 8, 15), slot('h-pull', 3, 8, 15),
        slot('hinge', 3, 10, 20), slot('v-push', 2, 8, 15), slot('core', 3, 10, 30),
      ]},
      { id: 'fb-rest1', name: 'Rest', slots: [] },
      { id: 'fb-2', name: 'Full Body B', slots: [
        slot('hinge', 3, 8, 15), slot('v-pull', 3, 5, 12), slot('h-push', 3, 8, 15),
        slot('squat', 3, 10, 20), slot('side-delt', 3, 12, 20), slot('biceps', 2, 8, 15),
      ]},
      { id: 'fb-rest2', name: 'Rest', slots: [] },
      { id: 'fb-3', name: 'Full Body C', slots: [
        slot('squat', 3, 8, 15), slot('h-pull', 3, 8, 15), slot('v-push', 3, 8, 15),
        slot('hinge', 3, 10, 20), slot('triceps', 3, 10, 15), slot('core', 3, 10, 30),
      ]},
      { id: 'fb-rest3', name: 'Rest', slots: [] },
      { id: 'fb-rest4', name: 'Rest / easy run', slots: [] },
    ],
  },
  // Upper / Lower ×4
  HOME_UL: {
    id: 'HOME_UL', name: 'Upper / Lower',
    days: [
      { id: 'ul-u1', name: 'Upper A', slots: [
        slot('h-push', 4, 8, 15), slot('h-pull', 4, 8, 15), slot('v-push', 3, 8, 15),
        slot('v-pull', 3, 5, 12), slot('side-delt', 3, 12, 20), slot('biceps', 2, 8, 15), slot('triceps', 2, 10, 15),
      ]},
      { id: 'ul-l1', name: 'Lower A', slots: [
        slot('squat', 4, 8, 15), slot('hinge', 4, 8, 15), slot('q-bulgarian-ph', 3, 8, 15),
        slot('calf', 4, 12, 25), slot('core', 3, 10, 30),
      ]},
      { id: 'ul-rest1', name: 'Rest', slots: [] },
      { id: 'ul-u2', name: 'Upper B', slots: [
        slot('v-pull', 4, 5, 12), slot('h-push', 4, 8, 15), slot('h-pull', 3, 8, 15),
        slot('v-push', 3, 8, 15), slot('side-delt', 3, 12, 20), slot('triceps', 2, 10, 15), slot('biceps', 2, 8, 15),
      ]},
      { id: 'ul-l2', name: 'Lower B', slots: [
        slot('hinge', 4, 8, 15), slot('squat', 4, 10, 20), slot('hinge', 3, 10, 20),
        slot('calf', 4, 12, 25), slot('core', 3, 10, 30),
      ]},
      { id: 'ul-rest2', name: 'Rest', slots: [] },
      { id: 'ul-rest3', name: 'Rest / easy run', slots: [] },
    ],
  },
  // Home PPL ×6 (advanced, enough equipment)
  HOME_PPL: {
    id: 'HOME_PPL', name: 'Home PPL',
    days: [
      { id: 'hp-push1', name: 'Push', slots: [
        slot('h-push', 4, 8, 15), slot('v-push', 3, 8, 15), slot('side-delt', 3, 12, 20), slot('triceps', 3, 10, 15),
      ]},
      { id: 'hp-pull1', name: 'Pull', slots: [
        slot('v-pull', 4, 5, 12), slot('h-pull', 4, 8, 15), slot('biceps', 3, 8, 15), slot('core', 3, 10, 30),
      ]},
      { id: 'hp-legs1', name: 'Legs', slots: [
        slot('squat', 4, 8, 15), slot('hinge', 4, 8, 15), slot('squat', 3, 12, 20), slot('calf', 4, 12, 25),
      ]},
      { id: 'hp-push2', name: 'Push', slots: [
        slot('v-push', 4, 8, 15), slot('h-push', 3, 8, 15), slot('side-delt', 3, 12, 20), slot('triceps', 3, 10, 15),
      ]},
      { id: 'hp-pull2', name: 'Pull', slots: [
        slot('h-pull', 4, 8, 15), slot('v-pull', 3, 5, 12), slot('biceps', 3, 8, 15), slot('core', 3, 10, 30),
      ]},
      { id: 'hp-legs2', name: 'Legs', slots: [
        slot('hinge', 4, 8, 15), slot('squat', 4, 10, 20), slot('hinge', 3, 10, 20), slot('calf', 4, 12, 25),
      ]},
      { id: 'hp-rest', name: 'Rest', slots: [] },
    ],
  },
};
