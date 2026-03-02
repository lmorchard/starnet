#!/usr/bin/env node
// @ts-check
// Network census — batch analysis of generated networks across the difficulty matrix.
// Produces LLM-readable reports for balance tuning.
//
// Usage:
//   node scripts/network-census.js                    # summary table (all 36 combos)
//   node scripts/network-census.js --detail B,B       # per-seed detail for one combo
//   node scripts/network-census.js --detail all       # per-seed detail for all combos
//   node scripts/network-census.js --seeds 20         # override sample count

import { generateNetwork } from "../js/core/network/network-gen.js";
import { analyzeTopology, estimateResources } from "./census-metrics.js";

const GRADES = ["F", "D", "C", "B", "A", "S"];

// ── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  let detail = null;
  let seeds = 10;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--detail" && args[i + 1]) {
      detail = args[++i];
    } else if (args[i] === "--seeds" && args[i + 1]) {
      seeds = parseInt(args[++i], 10);
      if (isNaN(seeds) || seeds < 1) seeds = 10;
    }
  }

  return { detail, seeds };
}

// ── Data collection ──────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   tc: string, mc: string, seed: string,
 *   topology: ReturnType<typeof analyzeTopology>,
 *   resources: ReturnType<typeof estimateResources>,
 * }} SampleResult
 */

/**
 * Generate and analyze one network.
 * @param {string} seed
 * @param {string} tc
 * @param {string} mc
 * @returns {SampleResult}
 */
function runSample(seed, tc, mc) {
  const network = generateNetwork(seed, tc, mc);
  const topology = analyzeTopology(network);
  const resources = estimateResources(topology, mc);
  return { tc, mc, seed, topology, resources };
}

/**
 * Run N samples for a single difficulty combo.
 * @param {string} tc
 * @param {string} mc
 * @param {number} seedCount
 * @returns {SampleResult[]}
 */
function runCombo(tc, mc, seedCount) {
  const results = [];
  for (let i = 0; i < seedCount; i++) {
    results.push(runSample(`census-${i}`, tc, mc));
  }
  return results;
}

// ── Aggregation ──────────────────────────────────────────────────────────────

/**
 * @param {number[]} arr
 * @returns {{ min: number, max: number, avg: number }}
 */
function stats(arr) {
  if (arr.length === 0) return { min: 0, max: 0, avg: 0 };
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
  return { min, max, avg };
}

/**
 * @typedef {{
 *   tc: string, mc: string,
 *   nodes: { min: number, max: number, avg: number },
 *   critPath: { min: number, max: number, avg: number },
 *   gates: { min: number, max: number, avg: number },
 *   estUses: { min: number, max: number, avg: number },
 *   deficit: { min: number, max: number, avg: number },
 *   startUses: number,
 *   startCash: number,
 *   handSize: number,
 *   setPiecePct: number,
 *   iceGrade: string,
 *   critGradesExample: string[],
 * }} ComboSummary
 */

/**
 * Aggregate samples into a summary.
 * @param {SampleResult[]} samples
 * @returns {ComboSummary}
 */
function summarize(samples) {
  const first = samples[0];
  return {
    tc: first.tc,
    mc: first.mc,
    nodes:    stats(samples.map(s => s.topology.nodeCount)),
    critPath: stats(samples.map(s => s.topology.critPathLength)),
    gates:    stats(samples.map(s => s.topology.critPathGates)),
    estUses:  stats(samples.map(s => s.resources.totalExpectedUses)),
    deficit:  stats(samples.map(s => s.resources.cardDeficit)),
    startUses: first.resources.startingUses,
    startCash: first.resources.startingCash,
    handSize:  first.resources.handSize,
    setPiecePct: samples.filter(s => s.topology.setPieceFired).length / samples.length,
    iceGrade:  first.topology.iceGrade,
    critGradesExample: first.topology.critPathGrades,
  };
}

// ── Formatting ───────────────────────────────────────────────────────────────

function fmt(n, decimals = 1) {
  return n.toFixed(decimals);
}

function pad(s, width) {
  return String(s).padEnd(width);
}

function rpad(s, width) {
  return String(s).padStart(width);
}

/**
 * Print the summary table header + rows.
 * @param {ComboSummary[]} summaries
 * @param {number} seedCount
 */
function printSummaryTable(summaries, seedCount) {
  console.log(`=== NETWORK CENSUS REPORT ===`);
  console.log(`Seeds: census-0 through census-${seedCount - 1} (${seedCount} per combo)`);
  console.log();
  console.log(`--- SUMMARY TABLE ---`);
  console.log(
    pad("TC", 4) + pad("MC", 4) +
    rpad("Nodes", 7) + rpad("Path", 6) + rpad("Gates", 7) +
    pad(" CritGrades", 18) +
    rpad("EstUses", 9) + rpad("StrtUses", 10) + rpad("Deficit", 9) +
    rpad("Cash", 7) + rpad("Hand", 6) +
    rpad("ICE", 5) + rpad("SetPc%", 8)
  );
  console.log("-".repeat(93));

  for (const s of summaries) {
    const grades = s.critGradesExample.length > 0
      ? s.critGradesExample.join("→")
      : "—";
    console.log(
      pad(s.tc, 4) + pad(s.mc, 4) +
      rpad(fmt(s.nodes.avg), 7) + rpad(fmt(s.critPath.avg), 6) + rpad(fmt(s.gates.avg), 7) +
      pad(" " + grades, 18) +
      rpad(fmt(s.estUses.avg), 9) + rpad(s.startUses, 10) + rpad(fmt(s.deficit.avg), 9) +
      rpad(s.startCash, 7) + rpad(s.handSize, 6) +
      rpad(s.iceGrade, 5) + rpad(Math.round(s.setPiecePct * 100) + "%", 8)
    );
  }
}

/**
 * Print per-seed detail for a single combo.
 * @param {SampleResult[]} samples
 */
function printDetail(samples) {
  const { tc, mc } = samples[0];
  console.log();
  console.log(`--- DETAIL: ${tc}/${mc} (${samples.length} seeds) ---`);
  console.log(
    pad("Seed", 12) +
    rpad("Nodes", 7) + rpad("Path", 6) + rpad("Gates", 7) +
    pad(" Grades", 18) +
    rpad("EstUses", 9) + rpad("Deficit", 9) +
    pad(" Piece?", 8)
  );
  console.log("-".repeat(76));

  for (const s of samples) {
    const grades = s.topology.critPathGrades.length > 0
      ? s.topology.critPathGrades.join("→")
      : "—";
    console.log(
      pad(s.seed, 12) +
      rpad(s.topology.nodeCount, 7) + rpad(s.topology.critPathLength, 6) + rpad(s.topology.critPathGates, 7) +
      pad(" " + grades, 18) +
      rpad(fmt(s.resources.totalExpectedUses), 9) + rpad(fmt(s.resources.cardDeficit), 9) +
      pad(" " + (s.topology.setPieceFired ? "yes" : "no"), 8)
    );
  }

  // Min/Max/Avg
  const nodeStats    = stats(samples.map(s => s.topology.nodeCount));
  const pathStats    = stats(samples.map(s => s.topology.critPathLength));
  const gateStats    = stats(samples.map(s => s.topology.critPathGates));
  const estUsesStats = stats(samples.map(s => s.resources.totalExpectedUses));
  const deficitStats = stats(samples.map(s => s.resources.cardDeficit));
  const piecePct     = samples.filter(s => s.topology.setPieceFired).length / samples.length;

  console.log("-".repeat(76));
  console.log(
    pad("Min", 12) +
    rpad(nodeStats.min, 7) + rpad(pathStats.min, 6) + rpad(gateStats.min, 7) +
    pad(" —", 18) +
    rpad(fmt(estUsesStats.min), 9) + rpad(fmt(deficitStats.min), 9) +
    pad(" —", 8)
  );
  console.log(
    pad("Max", 12) +
    rpad(nodeStats.max, 7) + rpad(pathStats.max, 6) + rpad(gateStats.max, 7) +
    pad(" —", 18) +
    rpad(fmt(estUsesStats.max), 9) + rpad(fmt(deficitStats.max), 9) +
    pad(" —", 8)
  );
  console.log(
    pad("Avg", 12) +
    rpad(fmt(nodeStats.avg), 7) + rpad(fmt(pathStats.avg), 6) + rpad(fmt(gateStats.avg), 7) +
    pad(" —", 18) +
    rpad(fmt(estUsesStats.avg), 9) + rpad(fmt(deficitStats.avg), 9) +
    pad(" " + Math.round(piecePct * 100) + "%", 8)
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const { detail, seeds } = parseArgs(process.argv);

/** @type {Map<string, SampleResult[]>} key "TC/MC" → samples */
const allSamples = new Map();
/** @type {ComboSummary[]} */
const summaries = [];

for (const tc of GRADES) {
  for (const mc of GRADES) {
    const samples = runCombo(tc, mc, seeds);
    allSamples.set(`${tc}/${mc}`, samples);
    summaries.push(summarize(samples));
  }
}

printSummaryTable(summaries, seeds);

// Detail view
if (detail === "all") {
  for (const [, samples] of allSamples) {
    printDetail(samples);
  }
} else if (detail) {
  const [dtc, dmc] = detail.toUpperCase().split(",");
  const key = `${dtc}/${dmc}`;
  const samples = allSamples.get(key);
  if (samples) {
    printDetail(samples);
  } else {
    console.error(`\nNo data for ${key}. Use grades like --detail B,B`);
    process.exit(1);
  }
}
