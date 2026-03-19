// @ts-check
// Bot Census — run the bot across many seeds and aggregate stats.
//
// Usage:
//   node scripts/bot/census.js --seeds 100 --threat C --wealth B
//   node scripts/bot/census.js --seeds 50 --threat S --wealth A --full
//   node scripts/bot/census.js --seeds 20 --network corporate-foothold

import { runBot } from "./run.js";
import { buildNetwork as buildCorporateFoothold } from "../../data/networks/corporate-foothold.js";
import { buildNetwork as buildResearchStation } from "../../data/networks/research-station.js";
import { buildNetwork as buildCorporateExchange } from "../../data/networks/corporate-exchange.js";
import { buildNetwork as buildGenerated } from "../../data/networks/generated.js";

const NETWORKS = {
  "corporate-foothold": buildCorporateFoothold,
  "research-station": buildResearchStation,
  "corporate-exchange": buildCorporateExchange,
};

// ── Arg parsing ─────────────────────────────────────────────

let seedCount = 50;
let threat = "C", wealth = "B", complexity = "C", depth = "C";
let networkName = null;
let full = false;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--seeds" && argv[i + 1]) seedCount = parseInt(argv[++i], 10) || 50;
  else if (argv[i] === "--threat" && argv[i + 1]) threat = argv[++i];
  else if (argv[i] === "--wealth" && argv[i + 1]) wealth = argv[++i];
  else if (argv[i] === "--complexity" && argv[i + 1]) complexity = argv[++i];
  else if (argv[i] === "--depth" && argv[i + 1]) depth = argv[++i];
  else if (argv[i] === "--network" && argv[i + 1]) networkName = argv[++i];
  else if (argv[i] === "--full") full = true;
}

const spec = { threat, wealth, complexity, depth };

// ── Run census ──────────────────────────────────────────────

/** @type {any[]} */
const runs = [];

for (let i = 0; i < seedCount; i++) {
  const seed = `census-${i}`;
  try {
    /** @returns {{ graphDef: any, meta: any }} */
    const buildFn = () => {
      if (networkName) {
        const fn = NETWORKS[networkName];
        if (!fn) {
          throw new Error(`Unknown network: ${networkName}. Available: ${Object.keys(NETWORKS).join(", ")}`);
        }
        return fn();
      }
      return buildGenerated({ seed, spec });
    };
    const stats = runBot(buildFn, { seed });
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
  avgCardsUsed: avg(runs, "cardsUsed"),
  avgCardsBurned: avg(runs, "cardsBurned"),
  avgStoreVisits: avg(runs, "storeVisits"),
  peakAlertDistribution: countBy(runs, "peakAlert"),
  traceFiredRate: Math.round((traceCount / runs.length) * 1000) / 1000,
  avgIceDetections: avg(runs, "iceDetections"),
  avgIceEvasions: avg(runs, "iceEvasions"),
  avgDisarmActions: avg(runs, "disarmActionsUsed"),
};

// ── Output ──────────────────────────────────────────────────

const output = {
  config: {
    seeds: seedCount,
    spec,
    network: networkName ?? "generated",
  },
  summary,
};

if (full) {
  output.runs = runs;
}

console.log(JSON.stringify(output, null, 2));
