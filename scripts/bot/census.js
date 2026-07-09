// @ts-check
// Bot Census — run the bot across many seeds and aggregate stats.
//
// Usage:
//   node scripts/bot/census.js --seeds 100 --threat C --wealth B
//   node scripts/bot/census.js --seeds 50 --threat S --wealth A --full
//   node scripts/bot/census.js --seeds 20 --network corporate-foothold

import { runBot, LOADOUT_PRESETS } from "./run.js";
import { NAMED_NETWORKS, buildGenerated } from "../../data/networks/index.js";
import { parseGradeArgs } from "../lib/grade-args.js";

// ── Arg parsing ─────────────────────────────────────────────

let seedCount = 50;
let networkName = null;
let full = false;
let comparePresets = false;
/** @type {string[]|null} null = no gear (bare); override with --loadout <preset> */
let loadout = null;

const argv = process.argv.slice(2);
const spec = parseGradeArgs(argv);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--seeds" && argv[i + 1]) seedCount = parseInt(argv[++i], 10) || 50;
  else if (argv[i] === "--network" && argv[i + 1]) networkName = argv[++i];
  else if (argv[i] === "--full") full = true;
  else if (argv[i] === "--compare-presets") comparePresets = true;
  else if (argv[i] === "--loadout" && argv[i + 1]) {
    const presetName = argv[++i];
    if (!(presetName in LOADOUT_PRESETS)) {
      console.error(`Unknown loadout preset: "${presetName}". Available: ${Object.keys(LOADOUT_PRESETS).join(", ")}`);
      process.exit(1);
    }
    loadout = LOADOUT_PRESETS[presetName];
  }
}

// ── Run census ──────────────────────────────────────────────

/** @type {any[]} */
const runs = [];

for (let i = 0; i < seedCount; i++) {
  const seed = `census-${i}`;
  try {
    /** @returns {{ graphDef: any, meta: any }} */
    const buildFn = () => {
      if (networkName) {
        const fn = NAMED_NETWORKS[networkName];
        if (!fn) {
          throw new Error(`Unknown network: ${networkName}. Available: ${Object.keys(NAMED_NETWORKS).join(", ")}`);
        }
        return fn();
      }
      return buildGenerated({ seed, spec });
    };
    const stats = runBot(buildFn, { seed, loadout: loadout ?? [] });
    runs.push(stats);
  } catch (e) {
    runs.push({ success: false, failReason: "error", error: e.message });
  }
  // Progress to stderr (doesn't pollute JSON stdout)
  if ((i + 1) % 10 === 0 || i === seedCount - 1) {
    process.stderr.write(`\r  ${i + 1}/${seedCount} seeds...`);
  }
}
process.stderr.write("\n");

// ── Aggregate ───────────────────────────────────────────────

function avg(arr, field) {
  const vals = arr.filter(r => r[field] !== undefined).map(r => r[field]);
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

function countBy(arr, field) {
  const counts = {};
  for (const r of arr) {
    const key = r[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

const successCount = runs.filter(r => r.success).length;
const traceCount = runs.filter(r => r.traceFired).length;

const summary = {
  successRate: Math.round((successCount / runs.length) * 1000) / 1000,
  failReasons: countBy(runs.filter(r => !r.success), "failReason"),
  avgTicksElapsed: avg(runs, "ticksElapsed"),
  avgNodesOwned: avg(runs, "nodesOwned"),
  avgNodesTotal: avg(runs, "nodesTotal"),
  avgCash: avg(runs, "cashRemaining"),
  avgCashSpent: avg(runs, "cashSpent"),
  avgAutoBurns: avg(runs, "autoBurns"),
  avgStoreVisits: avg(runs, "storeVisits"),
  peakAlertDistribution: countBy(runs, "peakAlert"),
  traceFiredRate: Math.round((traceCount / runs.length) * 1000) / 1000,
  avgIceDetections: avg(runs, "iceDetections"),
  avgIceEvasions: avg(runs, "iceEvasions"),
  avgDisarmActions: avg(runs, "disarmActionsUsed"),
  // Mine usage (Phase 2 tuning signal)
  runsUsingMine: runs.filter(r => (r.mineAttempts ?? 0) > 0).length,
  avgMineAttempts: avg(runs, "mineAttempts"),
  avgMineResolved: avg(runs, "mineResolved"),
  avgMineRounds: avg(runs, "mineRounds"),
  mineHitRate: (() => {
    const resolved = runs.reduce((a, r) => a + (r.mineResolved ?? 0), 0);
    const rounds = runs.reduce((a, r) => a + (r.mineRounds ?? 0), 0);
    return resolved > 0 ? Math.round((rounds / resolved) * 1000) / 1000 : 0;
  })(),
  // Efficiency metrics (gear-sensitivity signal)
  avgRoundsFired: avg(runs, "roundsFired"),
  avgHeat: avg(runs, "heatGenerated"),
};

// ── Compare-presets mode ─────────────────────────────────────
// Run all named presets and print a side-by-side efficiency table to stdout.
// Usage: node scripts/bot/census.js --compare-presets --seeds 20

if (comparePresets) {
  /** @param {any[]} runSet */
  function summariseRuns(runSet) {
    const successCount = runSet.filter(r => r.success).length;
    const traceCount = runSet.filter(r => r.traceFired).length;
    return {
      successRate: Math.round((successCount / runSet.length) * 1000) / 1000,
      traceFiredRate: Math.round((traceCount / runSet.length) * 1000) / 1000,
      avgAutoBurns: avg(runSet, "autoBurns"),
      avgCash: avg(runSet, "cashRemaining"),
      avgRoundsFired: avg(runSet, "roundsFired"),
      avgHeat: avg(runSet, "heatGenerated"),
    };
  }

  /** @type {Record<string, ReturnType<typeof summariseRuns>>} */
  const results = {};

  for (const [presetName, presetGear] of Object.entries(LOADOUT_PRESETS)) {
    /** @type {any[]} */
    const presetRuns = [];
    process.stderr.write(`\n  ${presetName}: `);
    for (let i = 0; i < seedCount; i++) {
      const seed = `census-${i}`;
      try {
        const buildFn = () => {
          if (networkName) {
            const fn = NAMED_NETWORKS[networkName];
            if (!fn) throw new Error(`Unknown network: ${networkName}`);
            return fn();
          }
          return buildGenerated({ seed, spec });
        };
        presetRuns.push(runBot(buildFn, { seed, loadout: presetGear }));
      } catch (e) {
        presetRuns.push({ success: false, failReason: "error", error: e.message });
      }
      if ((i + 1) % 10 === 0 || i === seedCount - 1) {
        process.stderr.write(`${i + 1}/${seedCount}... `);
      }
    }
    results[presetName] = summariseRuns(presetRuns);
  }
  process.stderr.write("\n\n");

  // Print comparison table
  const presetNames = Object.keys(LOADOUT_PRESETS);
  const cols = ["preset", "successRate", "traceFiredRate", "avgAutoBurns", "avgCash", "avgRoundsFired", "avgHeat"];
  const widths = cols.map(c => c.length);
  for (const name of presetNames) {
    widths[0] = Math.max(widths[0], name.length);
    const row = results[name];
    cols.slice(1).forEach((c, i) => {
      widths[i + 1] = Math.max(widths[i + 1], String(row[c]).length);
    });
  }

  /** @param {string} s @param {number} w */
  const pad = (s, w) => String(s).padStart(w);
  const header = cols.map((c, i) => pad(c, widths[i])).join("  ");
  const sep = widths.map(w => "-".repeat(w)).join("  ");
  console.log(header);
  console.log(sep);
  for (const name of presetNames) {
    const row = results[name];
    const cells = [pad(name, widths[0]), ...cols.slice(1).map((c, i) => pad(row[c], widths[i + 1]))];
    console.log(cells.join("  "));
  }
  process.exit(0);
}

// ── Output ──────────────────────────────────────────────────

// Derive preset name for reporting (reverse-lookup)
const loadoutPresetName = loadout === null
  ? "bare"
  : Object.entries(LOADOUT_PRESETS).find(([, ids]) =>
      ids.length === loadout.length && ids.every((id) => loadout.includes(id))
    )?.[0] ?? "custom";

const output = {
  config: {
    seeds: seedCount,
    spec,
    network: networkName ?? "generated",
    loadout: loadout ?? [],
    loadoutPreset: loadoutPresetName,
  },
  summary,
};

if (full) {
  output.runs = runs;
}

console.log(JSON.stringify(output, null, 2));
