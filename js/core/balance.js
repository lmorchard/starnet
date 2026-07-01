// @ts-check
// Centralized game-balance / tuning constants (#169).
//
// These knobs drive the difficulty curve and were previously scattered across
// combat.js, alert.js, and ice/runtime.js. Collecting them here makes the whole
// tuning surface legible in one place — useful alongside census work. Each module
// imports the constants it needs; the comments explaining WHY each value is what
// it is travel with the values. (Structural constants — e.g. the alert ladder
// order — stay with their subsystems; only tuning numbers live here.)

// ── Combat: exploit resolution ───────────────────────────────────────────────

// Success chance modifier by node security grade.
export const GRADE_MODIFIER = {
  S: 0.05,
  A: 0.15,
  B: 0.30,
  C: 0.50,
  D: 0.70,
  F: 0.90,
};

/** Flat bonus when exploit targets a known vulnerability on the node. */
export const MATCH_BONUS = 0.4;

/** Hard cap on exploit success probability. */
export const SUCCESS_CAP = 0.95;

// Disclosure chance on failure by grade (higher grade = more likely to detect and disclose).
export const DISCLOSURE_CHANCE = {
  S: 0.85,
  A: 0.70,
  B: 0.50,
  C: 0.30,
  D: 0.15,
  F: 0.05,
};

// Skip-to-owned floor and quality scaling. The chance a successful exploit
// jumps locked → owned in one shot is driven by card QUALITY, not rarity:
//   0.08 + quality * 0.55
// This lifts the floor across the board (a fresh common skips ~19–38% of the
// time, up from the old ~2–6%) while still rewarding the best cards most —
// rare cards skip more only because they carry higher quality, not because of
// a separate multiplier. Tops out near 0.60 for a best-in-class rare (q≈0.95);
// never approaches certainty.
export const SKIP_TO_OWNED_FLOOR = 0.08;
export const SKIP_TO_OWNED_QUALITY_SCALE = 0.55;

// Patch lag in turns by grade (how quickly vulns get patched after disclosure).
export const PATCH_LAG = {
  S: 1,
  A: 2,
  B: 3,
  C: 4,
  D: 6,
  F: 8,
};

// ── Alert / trace ────────────────────────────────────────────────────────────

// Detection thresholds: cumulative detections before trace starts, by ICE grade.
export const DETECTION_TRACE_THRESHOLD = { S: 1, A: 1, B: 2, C: 2, D: 3, F: 3 };

// Security-grid trace gate: accumulated monitor alerts before trace starts, by network grade.
// Mirrors DETECTION_TRACE_THRESHOLD (ICE) but kept separate so the passive grid and the active
// ICE pursuit can be tuned independently.
export const MONITOR_TRACE_THRESHOLD = { S: 4, A: 5, B: 7, C: 9, D: 12, F: 15 };

/** Trace countdown duration (seconds) scales with network threat grade. */
export const TRACE_SECONDS = { S: 30, A: 40, B: 45, C: 60, D: 75, F: 90 };

// ── Program noise (third alert sensor; Session 1) ────────────────────────────
// Each flow-program play adds heat; crossing the cumulative thresholds steps the
// SAME green→yellow→red→trace ladder, and the trace threshold starts the SAME
// trace clock. Quiet solutions are the skill. PLACEHOLDER VALUES — tuned by feel
// with Les (the bot doesn't use programs, so census only confirms no-regression).
export const PROGRAM_NOISE_COST = { sniff: 1, replay: 3 };
export const PROGRAM_NOISE_THRESHOLD = { yellow: 2, red: 4, trace: 6 };

// ── ICE movement / detection ─────────────────────────────────────────────────

// Grade → movement interval (ms); must be longer than the corresponding DWELL_TIMES entry.
// A/S slowed from 2500/3000 to give players a narrow window for exploit completion.
export const MOVE_INTERVALS = { S: 4000, A: 5000, B: 6000, C: 7000, D: 12000, F: 14000 };

// Grade → dwell time before detection (ms).
// S/A get very short dwells — tight but evadable with fast reactions.
// C/B bumped from 4500/3500 to give players a window to complete exploits.
export const DWELL_TIMES = { S: 800, A: 1500, B: 4500, C: 5500, D: 9000, F: 10000 };

// Grade → noise tick at which ICE first responds to an executing exploit.
// Exploit emits ticks 1–9 at 10%–90% of duration; 10% intervals.
export const ICE_NOISE_THRESHOLD = { S: 1, A: 2, B: 3, C: 5, D: 7, F: 9 };

// Delay before detection starts when ICE arrives via movement (ms).
// Matches the ICE movement animation duration so the visual and the
// detection timer stay in sync — player sees ICE arrive, then countdown starts.
export const ARRIVAL_DELAY_MS = 400;
