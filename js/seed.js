// Seed exercise library + Week A (PPL) + Week B (bro split) templates.
// Each exercise has form cues + a YouTube search URL for a demo video (no licensing risk)
// + an `imageUrl` pointing to the open-source Free Exercise DB (CC0) hosted on jsDelivr CDN.

const FX = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises';
const img = (folder) => `${FX}/${folder}/0.jpg`;

export const EXERCISES = [
  // PUSH
  { id: 'chest-press', name: 'Machine / Barbell Chest Press', primary: 'chest', secondary: ['shoulders','triceps'], equipment: 'machine', loadType: 'load', imageUrl: img('Barbell_Bench_Press_-_Medium_Grip'), cues: ['Brace your core, drive feet into the floor.', 'Bar/handles to mid-chest, elbows ~60° from torso.', 'Press straight, full lockout, controlled lower (2–3s).'] },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', primary: 'chest', secondary: ['shoulders','triceps'], equipment: 'dumbbells', loadType: 'load', imageUrl: img('Incline_Dumbbell_Press'), cues: ['Bench at ~30°.', 'Press up & slightly together, no clanging.', 'Stretch the chest at the bottom, no bounce.'] },
  { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', primary: 'shoulders', secondary: ['triceps','chest'], equipment: 'machine', loadType: 'load', imageUrl: img('Machine_Shoulder_Military_Press'), cues: ['Adjust seat so handles are at shoulder height.', 'Press up — full lockout, slight forward lean is fine.', 'Lower slowly, feel the delts working.'] },
  { id: 'lateral-raise', name: 'Cable Lateral Raise', primary: 'shoulders', secondary: [], equipment: 'cable', loadType: 'load', imageUrl: img('Side_Lateral_Raise'), cues: ['Slight lean away from the stack.', 'Lead with the elbow, hand stays just below shoulder.', 'Pause at the top, slow the negative.'] },
  { id: 'tri-pushdown', name: 'Triceps Pushdown', primary: 'triceps', secondary: [], equipment: 'cable', loadType: 'load', imageUrl: img('Triceps_Pushdown'), cues: ['Elbows pinned to your sides — they do not move.', 'Squeeze at the bottom for 1s.', 'Don\'t let the stack pull you forward.'] },
  { id: 'overhead-tri', name: 'Overhead Triceps Extension', primary: 'triceps', secondary: [], equipment: 'cable', loadType: 'load', imageUrl: img('Standing_Dumbbell_Triceps_Extension'), cues: ['Deep stretch — elbows fully bent behind your head.', 'Lock out fully without flaring the elbows.', 'Slow eccentric, no bouncing out of the stretch.'] },
  { id: 'dips', name: 'Dips', primary: 'chest', secondary: ['triceps','shoulders'], equipment: 'bodyweight', loadType: 'bodyweight+', imageUrl: img('Dips_-_Triceps_Version'), cues: ['Lean forward slightly for more chest, upright for triceps.', 'Lower until upper arms are parallel.', 'Lock out at the top, control the descent.'] },
  { id: 'cable-fly', name: 'Cable Fly', primary: 'chest', secondary: [], equipment: 'cable', loadType: 'load', imageUrl: img('Cable_Crossover'), cues: ['Slight forward step, ribs down.', 'Arc the hands — meet in front of your chest.', 'Don\'t bend the elbows more during the rep.'] },

  // PULL
  { id: 'lat-pulldown', name: 'Lat Pulldown', primary: 'lats', secondary: ['biceps'], equipment: 'cable', loadType: 'load', imageUrl: img('Wide-Grip_Lat_Pulldown'), cues: ['Sit tall, slight lean back, chest up.', 'Pull the bar to your collarbone, elbows down + back.', 'Slow eccentric — let the lats stretch at the top.'] },
  { id: 'seated-row', name: 'Seated Cable Row', primary: 'mid-back', secondary: ['lats','biceps'], equipment: 'cable', loadType: 'load', imageUrl: img('Seated_Cable_Rows'), cues: ['Tall torso, slight forward lean only at the stretch.', 'Pull to your stomach — squeeze the shoulder blades.', 'Don\'t use momentum from the hips.'] },
  { id: 'chest-supported-row', name: 'Chest-Supported / Machine Row', primary: 'mid-back', secondary: ['lats','biceps'], equipment: 'machine', loadType: 'load', imageUrl: img('T-Bar_Row_with_Handle'), cues: ['Chest into pad — no torso movement.', 'Pull elbows back, feel the squeeze for 1s.', 'Slow eccentric.'] },
  { id: 'face-pull', name: 'Face Pull', primary: 'rear-delts', secondary: ['traps'], equipment: 'cable', loadType: 'load', imageUrl: img('Face_Pull'), cues: ['Rope at upper-chest height.', 'Pull to your forehead — elbows high & wide.', 'External rotation at the end.'] },
  { id: 'biceps-curl', name: 'Dumbbell / Cable Biceps Curl', primary: 'biceps', secondary: ['forearms'], equipment: 'dumbbells', loadType: 'load', imageUrl: img('Dumbbell_Bicep_Curl'), cues: ['Elbows stay by your sides.', 'Curl up, supinate the wrist slightly.', 'Full stretch at the bottom — no swinging.'] },
  { id: 'hammer-curl', name: 'Hammer Curl', primary: 'biceps', secondary: ['forearms'], equipment: 'dumbbells', loadType: 'load', imageUrl: img('Hammer_Curls'), cues: ['Neutral grip (thumbs up).', 'Slow tempo — feel the brachialis & forearm.', 'No body english.'] },
  { id: 'pullover', name: 'Cable / Dumbbell Pullover', primary: 'lats', secondary: ['chest'], equipment: 'cable', loadType: 'load', imageUrl: img('Bent-Arm_Dumbbell_Pullover'), cues: ['Slight bend in elbows — keep it fixed.', 'Pull the bar in an arc to your hips.', 'Stretch the lats at the top.'] },

  // LEGS
  { id: 'leg-press', name: 'Leg Press', primary: 'quads', secondary: ['glutes','hamstrings'], equipment: 'machine', loadType: 'load', imageUrl: img('Leg_Press'), cues: ['Feet shoulder-width, mid-platform.', 'Lower until knees ~90° — back stays flat.', 'Drive through the whole foot, don\'t lock out hard.'] },
  { id: 'goblet-squat', name: 'Goblet Squat', primary: 'quads', secondary: ['glutes','core'], equipment: 'dumbbells', loadType: 'load', imageUrl: img('Goblet_Squat'), cues: ['Hold a dumbbell at your chest, elbows tucked.', 'Sit between your heels, knees track over toes.', 'Stand up tall — chest stays up the whole time.'] },
  { id: 'rdl', name: 'Romanian Deadlift', primary: 'hamstrings', secondary: ['glutes','low-back'], equipment: 'barbell', loadType: 'load', imageUrl: img('Romanian_Deadlift'), cues: ['Soft bend in the knees, push hips back.', 'Bar slides down your legs — feel the hamstring stretch.', 'Drive hips forward to stand, don\'t hyperextend.'] },
  { id: 'leg-extension', name: 'Leg Extension', primary: 'quads', secondary: [], equipment: 'machine', loadType: 'load', imageUrl: img('Leg_Extensions'), cues: ['Knees lined up with the pivot.', 'Full extension — squeeze the quad for 1s.', 'Controlled descent, no slamming the stack.'] },
  { id: 'leg-curl', name: 'Seated / Lying Leg Curl', primary: 'hamstrings', secondary: [], equipment: 'machine', loadType: 'load', imageUrl: img('Lying_Leg_Curls'), cues: ['Knees aligned with pivot.', 'Curl all the way through, squeeze briefly.', 'Slow eccentric — 3s if you can.'] },
  { id: 'calf-raise', name: 'Standing Calf Raise', primary: 'calves', secondary: [], equipment: 'machine', loadType: 'load', imageUrl: img('Standing_Calf_Raises'), cues: ['Full stretch at the bottom — pause 1s.', 'Drive all the way up to the top of your toes.', 'Slow tempo — calves respond to time under tension.'] },

  // SHOULDERS / ARMS (bro days)
  { id: 'ohp', name: 'Overhead Press (Barbell/DB)', primary: 'shoulders', secondary: ['triceps','core'], equipment: 'barbell', loadType: 'load', imageUrl: img('Standing_Military_Press'), cues: ['Brace hard, glutes tight.', 'Press straight up — head through at lockout.', 'Bar over mid-foot, no excessive arch.'] },
  { id: 'rear-delt-fly', name: 'Rear-Delt Fly', primary: 'rear-delts', secondary: ['traps'], equipment: 'machine', loadType: 'load', imageUrl: img('Reverse_Flyes'), cues: ['Light load — feel the rear delts, not the upper back.', 'Open up — pinky leads if it helps.', 'Pause and squeeze.'] },
  { id: 'shrug', name: 'Shrug', primary: 'traps', secondary: [], equipment: 'dumbbells', loadType: 'load', imageUrl: img('Dumbbell_Shrug'), cues: ['Straight up, not back-and-around.', 'Pause at the top for 1s.', 'Controlled descent.'] },

  // CORE / CONDITIONING
  { id: 'plank', name: 'Plank', primary: 'core', secondary: [], equipment: 'bodyweight', loadType: 'time', imageUrl: img('Plank'), cues: ['Hands or elbows below shoulders.', 'Glutes squeezed, ribs down — long straight line.', 'Breathe normally.'] },
  { id: 'hanging-knee-raise', name: 'Hanging Knee Raise', primary: 'core', secondary: [], equipment: 'pullup-bar', loadType: 'reps', imageUrl: img('Hanging_Leg_Raise'), cues: ['Tilt the pelvis up — don\'t just lift the legs.', 'Slow controlled lowering.', 'No swinging.'] },
  { id: 'cable-crunch', name: 'Cable Crunch', primary: 'core', secondary: [], equipment: 'cable', loadType: 'load', imageUrl: img('Cable_Crunch'), cues: ['Round the upper back toward the floor.', 'Bring elbows to thighs — short range, hard contraction.', 'Don\'t hinge from the hips.'] },
];

// Build an index for quick lookup.
export const EXERCISE_INDEX = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

// Week A — PPL ×2 (default, 6 days + 1 rest)
export const PPL_DAYS = [
  { id: 'push-1', name: 'Push',  slots: [
    { exerciseId: 'chest-press', sets: 3, repLow: 8,  repHigh: 12, restSec: 120 },
    { exerciseId: 'incline-db-press', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'machine-shoulder-press', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'lateral-raise', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'tri-pushdown', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'overhead-tri', sets: 2, repLow: 12, repHigh: 15, restSec: 60 },
  ]},
  { id: 'pull-1', name: 'Pull',  slots: [
    { exerciseId: 'lat-pulldown', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'seated-row', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'chest-supported-row', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'face-pull', sets: 3, repLow: 15, repHigh: 15, restSec: 60 },
    { exerciseId: 'biceps-curl', sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
    { exerciseId: 'hammer-curl', sets: 2, repLow: 12, repHigh: 15, restSec: 60 },
  ]},
  { id: 'legs-1', name: 'Legs', slots: [
    { exerciseId: 'leg-press', sets: 3, repLow: 8,  repHigh: 12, restSec: 150 },
    { exerciseId: 'rdl', sets: 3, repLow: 8,  repHigh: 12, restSec: 120 },
    { exerciseId: 'leg-extension', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'leg-curl', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'calf-raise', sets: 4, repLow: 12, repHigh: 20, restSec: 60 },
  ]},
  { id: 'push-2', name: 'Push',  slots: [
    { exerciseId: 'incline-db-press', sets: 3, repLow: 8,  repHigh: 12, restSec: 120 },
    { exerciseId: 'chest-press', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'machine-shoulder-press', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'lateral-raise', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'tri-pushdown', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'overhead-tri', sets: 2, repLow: 12, repHigh: 15, restSec: 60 },
  ]},
  { id: 'pull-2', name: 'Pull',  slots: [
    { exerciseId: 'seated-row', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'lat-pulldown', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'chest-supported-row', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'face-pull', sets: 3, repLow: 15, repHigh: 15, restSec: 60 },
    { exerciseId: 'hammer-curl', sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
    { exerciseId: 'biceps-curl', sets: 2, repLow: 12, repHigh: 15, restSec: 60 },
  ]},
  { id: 'legs-2', name: 'Legs', slots: [
    { exerciseId: 'goblet-squat', sets: 3, repLow: 8,  repHigh: 12, restSec: 150 },
    { exerciseId: 'rdl', sets: 3, repLow: 8,  repHigh: 12, restSec: 120 },
    { exerciseId: 'leg-extension', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'leg-curl', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'calf-raise', sets: 4, repLow: 12, repHigh: 20, restSec: 60 },
  ]},
  { id: 'rest-a', name: 'Rest', slots: [] },
];

// Week B — bro split. Coaching note shown in UI: less optimal for a beginner than PPL frequency.
export const BRO_DAYS = [
  { id: 'chest', name: 'Chest', slots: [
    { exerciseId: 'chest-press', sets: 4, repLow: 8,  repHigh: 12, restSec: 120 },
    { exerciseId: 'incline-db-press', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'cable-fly', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'dips', sets: 3, repLow: 8, repHigh: 12, restSec: 90 },
  ]},
  { id: 'back', name: 'Back', slots: [
    { exerciseId: 'lat-pulldown', sets: 4, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'seated-row', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'chest-supported-row', sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
    { exerciseId: 'pullover', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'face-pull', sets: 3, repLow: 15, repHigh: 15, restSec: 60 },
  ]},
  { id: 'legs', name: 'Legs', slots: [
    { exerciseId: 'leg-press', sets: 4, repLow: 8,  repHigh: 12, restSec: 150 },
    { exerciseId: 'rdl', sets: 3, repLow: 8,  repHigh: 12, restSec: 120 },
    { exerciseId: 'leg-extension', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'leg-curl', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'calf-raise', sets: 4, repLow: 12, repHigh: 20, restSec: 60 },
  ]},
  { id: 'shoulders', name: 'Shoulders', slots: [
    { exerciseId: 'ohp', sets: 4, repLow: 8, repHigh: 10, restSec: 120 },
    { exerciseId: 'lateral-raise', sets: 4, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'rear-delt-fly', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'shrug', sets: 3, repLow: 10, repHigh: 15, restSec: 60 },
  ]},
  { id: 'arms', name: 'Arms', slots: [
    { exerciseId: 'biceps-curl', sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
    { exerciseId: 'tri-pushdown', sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
    { exerciseId: 'hammer-curl', sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
    { exerciseId: 'overhead-tri', sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
  ]},
  { id: 'core', name: 'Core + Conditioning', slots: [
    { exerciseId: 'hanging-knee-raise', sets: 3, repLow: 10, repHigh: 15, restSec: 60 },
    { exerciseId: 'cable-crunch', sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    { exerciseId: 'plank', sets: 3, repLow: 30, repHigh: 60, restSec: 45 },
  ]},
  { id: 'rest-b', name: 'Rest', slots: [] },
];

export const PROGRAMS = {
  A: { id: 'A', name: 'PPL ×2', days: PPL_DAYS },
  B: { id: 'B', name: 'Bro Split', days: BRO_DAYS },
};

// Bodyweight fallback (travel / no gym) — quick session, can replace any day.
export const BODYWEIGHT_FALLBACK = [
  { exerciseId: 'dips', sets: 3, repLow: 5, repHigh: 12, restSec: 90 },
  { exerciseId: 'hanging-knee-raise', sets: 3, repLow: 8, repHigh: 15, restSec: 60 },
  { exerciseId: 'plank', sets: 3, repLow: 30, repHigh: 60, restSec: 60 },
];

// Substitution map — quick fallbacks when equipment is taken.
export const SUBSTITUTIONS = {
  'chest-press': ['incline-db-press', 'dips', 'cable-fly'],
  'incline-db-press': ['chest-press', 'cable-fly', 'dips'],
  'machine-shoulder-press': ['ohp', 'lateral-raise'],
  'lateral-raise': ['machine-shoulder-press', 'rear-delt-fly'],
  'tri-pushdown': ['overhead-tri', 'dips'],
  'overhead-tri': ['tri-pushdown', 'dips'],
  'dips': ['chest-press', 'tri-pushdown'],
  'cable-fly': ['incline-db-press', 'chest-press'],
  'lat-pulldown': ['chest-supported-row', 'seated-row', 'pullover'],
  'seated-row': ['chest-supported-row', 'lat-pulldown'],
  'chest-supported-row': ['seated-row', 'lat-pulldown'],
  'face-pull': ['rear-delt-fly'],
  'biceps-curl': ['hammer-curl'],
  'hammer-curl': ['biceps-curl'],
  'pullover': ['lat-pulldown', 'chest-supported-row'],
  'leg-press': ['goblet-squat', 'leg-extension'],
  'goblet-squat': ['leg-press', 'leg-extension'],
  'rdl': ['leg-curl'],
  'leg-extension': ['leg-press', 'goblet-squat'],
  'leg-curl': ['rdl'],
  'calf-raise': [],
  'ohp': ['machine-shoulder-press'],
  'rear-delt-fly': ['face-pull'],
  'shrug': [],
  'plank': ['hanging-knee-raise', 'cable-crunch'],
  'hanging-knee-raise': ['cable-crunch', 'plank'],
  'cable-crunch': ['hanging-knee-raise', 'plank'],
};
