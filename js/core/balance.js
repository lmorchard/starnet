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

// ── Heat (decaying "notice" meter; anti-tedium arc) ──────────────────────────
// Activity (probe/xploit/programs) adds heat; the HEAT_DECAY timer bleeds it off. Crossing a
// network's (hidden) HEAT_ALARM_THRESHOLD trips ONE step up the alert ladder and discharges heat
// (→ threshold*HEAT_DISCHARGE_FRAC) so it must rebuild — bursts trip, paced play stays cool.
// PLACEHOLDER VALUES — feel + census tuned with Les (heat now feeds probe/xploit, so it moves the
// bot's difficulty curve; census is a real gate, not just no-regression).
export const HEAT_COST = { probe: 1, xploit: 0.1, sniff: 1, replay: 3, sweep: 2 };
export const HEAT_ALARM_THRESHOLD = { S: 6, A: 8, B: 11, C: 15, D: 20, F: 26 }; // grade-keyed sensitivity
export const HEAT_DECAY_PER_TICK = 0.6;   // heat shed per HEAT_DECAY interval (pacing must actually cool)
export const HEAT_DISCHARGE_FRAC = 0.5;   // on a trip, heat → threshold * this
export const HEAT_DECAY_MS = 1000;        // decay interval (mirrors TRACE_TICK cadence)
export const LIE_LOW_HEAT_DROP = 6;       // lie-low's accelerated heat shed (Phase 4)

// Feel-draft timed-action durations for the flow programs (#187 Phase 2). Ticks (100ms each).
// SNIFF is a quick read; REPLAY is a heavier credential injection. Tuned in Part 3.
export const SNIFF_DURATION = 12;
export const REPLAY_DURATION = 20;

// ── SWEEP (progressive probe flood-fill; verb variants) ──────────────────────
// SWEEP starts a REAL timed probe on each frontier node in parallel (grade-scaled probe duration,
// probe animation, resolveProbe on completion). A wave advances to the next layer only when its
// probes finish — so it propagates over real probe-time, "like parallel probes through the network."
// Each node hit charges HEAT_COST.sweep up front (a rise per node) plus HEAT_COST.probe on completion
// — so a wide/deep sweep is genuinely loud. Values PLACEHOLDER — feel + census tuned.
export const SWEEP_MAX_DEPTH = 6;         // hard ceiling; the "max" depth option

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

// ── Coherence erosion (exploit hoard auto-burn; E1) ──────────────────────────
// Node coherence reserve by grade — how much fuzzing it absorbs before it faults.
// Ported from feel-lab A (starting points; feel + census tuned later).
export const COHERENCE      = { S: 2000, A: 1200, B: 700, C: 400, D: 220, F: 140 };
// Base per-shot bite by grade (soft nodes take fatter chips).
export const CHIP_FACTOR    = { S: 6, A: 10, B: 16, C: 26, D: 40, F: 60 };
// Rarity multiplier on the bite.
export const RARITY_PUNCH   = { common: 1, uncommon: 2.2, rare: 5 };
// Type-match amplifier: a round whose type hits the node's revealed vuln profile
// bites (1 + TYPE_BITE)x harder. Type amplifies; it does not gate eligibility.
export const TYPE_BITE      = 1.0;
// ± per-shot jitter fraction (liveliness; every shot still counts toward the break).
export const CHIP_JITTER    = 0.15;
// Run heat ceiling (the abort wager) — auto-burn stops when burst heat hits this.
export const BURN_CEILING_DEFAULT = 40;
