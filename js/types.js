// Shared JSDoc type definitions. With jsconfig.json `checkJs`, editors type-check the codebase
// against these — catching the class of bugs (undefined fields, wrong shapes) we hit during QA.
// This file emits no runtime code; it's documentation that the language server enforces.

/**
 * @typedef {Object} LoggedSet
 * @property {string} id
 * @property {string} sessionId
 * @property {string} exerciseId
 * @property {string} createdAt ISO timestamp
 * @property {'working'|'warmup'|'drop'|'failure'} type
 * @property {number} weightKg
 * @property {number} reps
 * @property {number|null} [rpe]
 * @property {boolean} [perSide]
 * @property {number|null} [tutSec] time-under-tension seconds
 */

/**
 * @typedef {Object} WorkoutSession
 * @property {string} id
 * @property {string} date ISO
 * @property {string} dayId
 * @property {string} dayLabel
 * @property {'A'|'B'|'HOME'} weekType
 * @property {'active'|'done'|'skipped'} status
 * @property {string} notes
 */

/**
 * @typedef {Object} ExerciseSlot
 * @property {string} [exerciseId]
 * @property {string} [pattern]  movement pattern (home programs)
 * @property {number} sets
 * @property {number} repLow
 * @property {number} repHigh
 * @property {number} restSec
 * @property {string} [tempo] e.g. "3-1-1-0"
 */

/**
 * @typedef {Object} PRRecord
 * @property {number} bestE1RM
 * @property {number} bestWeightKg
 * @property {number} bestReps
 * @property {number} bestVolume
 * @property {boolean} [bodyweight]
 * @property {string} [lastUpdated]
 */

/**
 * @typedef {Object} DailyLog
 * @property {string} id
 * @property {string} date
 * @property {number} sleepHours
 * @property {number} sleepQuality 1-5
 * @property {number} mood 1-5
 * @property {number} energy 1-5
 * @property {number} soreness 1-5
 * @property {number} stress 1-5
 * @property {number} [hrvMs]
 * @property {number} [restingHR]
 * @property {boolean} [pain]
 * @property {string} [note]
 */

/**
 * @typedef {Object} Settings
 * @property {'kg'|'lb'} units
 * @property {boolean} autoAlternateWeeks
 * @property {number} deloadEvery
 * @property {string} apiKey
 * @property {'anthropic'|'openai'|'gemini'|'groq'} aiProvider
 * @property {string} aiModel
 * @property {'dark'|'light'|'system'} theme
 * @property {'default'|'large'|'larger'} textSize
 * @property {'balanced'|'strict'|'supportive'|'hardcore'} coachPersona
 */

/**
 * @typedef {Object} AppState
 * @property {number} version
 * @property {Settings} settings
 * @property {'gym'|'home'} trainingMode
 * @property {Object<string, boolean>} equipment
 * @property {WorkoutSession[]} sessions
 * @property {LoggedSet[]} sets
 * @property {Object<string, PRRecord>} prs
 * @property {DailyLog[]} dailyLogs
 * @property {Object<string,string>} homeLadderPos pattern → exerciseId
 */

export {}; // make this a module
