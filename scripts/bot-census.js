#!/usr/bin/env node
// @ts-check
// Bot census — Monte Carlo simulation across difficulty combinations.
// Runs an automated greedy bot many times per difficulty and prints
// an LLM-readable report of completion rates and resource distributions.
//
// Usage:
//   node scripts/bot-census.js --time B --money B              # 100 runs at B/B
//   node scripts/bot-census.js --time B --money B --seeds 50   # 50 runs
//   node scripts/bot-census.js --time F --money F              # easy baseline

import { generateNetwork } from "../js/network-gen.js";
import { runBot } from "./bot-player.js";

// ── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  let tc = null;
  let mc = null;
  let seeds = 100;
  let seedPrefix = "bot";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--time" && args[i + 1]) {
      tc = args[++i].toUpperCase();
    } else if (args[i] === "--money" && args[i + 1]) {
      mc = args[++i].toUpperCase();
    } else if (args[i] === "--seeds" && args[i + 1]) {
      seeds = parseInt(args[++i], 10);
      if (isNaN(seeds) || seeds < 1) seeds = 100;
    } else if (args[i] === "--seed-prefix" && args[i + 1]) {
      seedPrefix = args[++i];
    }
  }

  if (!tc || !mc) {
    console.error("Usage: node scripts/bot-census.js --time <grade> --money <grade> [--seeds N] [--seed-prefix str]");
    process.exit(1);
  }

  return { tc, mc, seeds, seedPrefix };
}

// ── Stats aggregation ────────────────────────────────────────────────────────

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

function fmt(n, decimals = 1) {
  return n.toFixed(decimals);
}

function pct(n, total) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

// ── Report formatting ────────────────────────────────────────────────────────

/**
 * @param {import('./bot-player.js').BotRunStats[]} results
 * @param {string} tc
 * @param {string} mc
 * @param {number} seedCount
 * @param {string} seedPrefix
 */
function printReport(results, tc, mc, seedCount, seedPrefix) {
  const total = results.length;
  const succeeded = results.filter(r => r.missionSuccess);
  const failed = results.filter(r => !r.missionSuccess);

  // Failure reasons
  const failReasons = {};
  for (const r of failed) {
    const reason = r.failReason ?? "unknown";
    failReasons[reason] = (failReasons[reason] ?? 0) + 1;
  }
  const failStr = Object.entries(failReasons)
    .map(([k, v]) => `${k}=${v}`)
    .join("  ") || "none";

  // Full clear
  const fullClears = results.filter(r => r.fullClear).length;
  const nodeStats = stats(results.map(r => r.nodesOwned));
  const nodeTotals = stats(results.map(r => r.nodesTotal));

  // Resource stats (succeeded runs)
  const sUses   = stats(succeeded.map(r => r.cardUsesConsumed));
  const sBurned = stats(succeeded.map(r => r.cardsBurned));
  const sStore  = stats(succeeded.map(r => r.storeVisits));
  const sCash   = stats(succeeded.map(r => r.cashSpent));
  const sLeft   = stats(succeeded.map(r => r.cashRemaining));

  // Resource stats (all runs)
  const aUses   = stats(results.map(r => r.cardUsesConsumed));
  const aBurned = stats(results.map(r => r.cardsBurned));
  const aStore  = stats(results.map(r => r.storeVisits));
  const aCash   = stats(results.map(r => r.cashSpent));

  // Ticks
  const succTicks = stats(succeeded.map(r => r.totalTicks));
  const failTicks = stats(failed.map(r => r.totalTicks));

  // Pressure
  const alertCounts = { green: 0, yellow: 0, red: 0 };
  for (const r of results) alertCounts[r.peakAlert] = (alertCounts[r.peakAlert] ?? 0) + 1;
  const traceFired = results.filter(r => r.traceFired).length;
  const iceStats = stats(results.map(r => r.iceDetections));

  // Print
  console.log(`=== BOT SIMULATION: ${tc}/${mc} ===`);
  console.log(`Seeds: ${seedPrefix}-0 through ${seedPrefix}-${seedCount - 1} (${seedCount} runs)`);
  console.log();

  console.log(`--- MISSION COMPLETION ---`);
  console.log(`Success rate:     ${succeeded.length}/${total} (${pct(succeeded.length, total)}%)`);
  if (succeeded.length > 0) {
    console.log(`Avg ticks:        ${fmt(succTicks.avg, 0)} (succeeded) / ${failed.length > 0 ? fmt(failTicks.avg, 0) : "—"} (failed)`);
  } else {
    console.log(`Avg ticks:        — (succeeded) / ${failed.length > 0 ? fmt(failTicks.avg, 0) : "—"} (failed)`);
  }
  console.log(`Failure reasons:  ${failStr}`);
  console.log();

  console.log(`--- FULL EXPLORATION ---`);
  console.log(`Full clear rate:  ${fullClears}/${total} (${pct(fullClears, total)}%)`);
  console.log(`Avg nodes owned:  ${fmt(nodeStats.avg)} / ${fmt(nodeTotals.avg)} total (${pct(nodeStats.avg, nodeTotals.avg)}%)`);
  console.log();

  if (succeeded.length > 0) {
    console.log(`--- RESOURCE USAGE (${succeeded.length} succeeded runs) ---`);
    console.log(`              Min    Avg    Max`);
    console.log(`Card uses:    ${fmt(sUses.min).padStart(4)}   ${fmt(sUses.avg).padStart(5)}   ${fmt(sUses.max).padStart(4)}`);
    console.log(`Cards burned: ${fmt(sBurned.min).padStart(4)}   ${fmt(sBurned.avg).padStart(5)}   ${fmt(sBurned.max).padStart(4)}`);
    console.log(`Store visits: ${fmt(sStore.min).padStart(4)}   ${fmt(sStore.avg).padStart(5)}   ${fmt(sStore.max).padStart(4)}`);
    console.log(`Cash spent:   ${fmt(sCash.min, 0).padStart(4)}   ${fmt(sCash.avg, 0).padStart(5)}   ${fmt(sCash.max, 0).padStart(4)}`);
    console.log(`Cash left:    ${fmt(sLeft.min, 0).padStart(4)}   ${fmt(sLeft.avg, 0).padStart(5)}   ${fmt(sLeft.max, 0).padStart(4)}`);
  } else {
    console.log(`--- RESOURCE USAGE (all runs — no successes) ---`);
    console.log(`              Min    Avg    Max`);
    console.log(`Card uses:    ${fmt(aUses.min).padStart(4)}   ${fmt(aUses.avg).padStart(5)}   ${fmt(aUses.max).padStart(4)}`);
    console.log(`Cards burned: ${fmt(aBurned.min).padStart(4)}   ${fmt(aBurned.avg).padStart(5)}   ${fmt(aBurned.max).padStart(4)}`);
    console.log(`Store visits: ${fmt(aStore.min).padStart(4)}   ${fmt(aStore.avg).padStart(5)}   ${fmt(aStore.max).padStart(4)}`);
    console.log(`Cash spent:   ${fmt(aCash.min, 0).padStart(4)}   ${fmt(aCash.avg, 0).padStart(5)}   ${fmt(aCash.max, 0).padStart(4)}`);
  }
  console.log();

  console.log(`--- PRESSURE ---`);
  console.log(`Peak alert:   GREEN=${alertCounts.green}  YELLOW=${alertCounts.yellow}  RED=${alertCounts.red}`);
  console.log(`Trace fired:  ${traceFired}/${total}`);
  console.log(`ICE detects:  avg ${fmt(iceStats.avg)}  max ${iceStats.max}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const { tc, mc, seeds, seedPrefix } = parseArgs(process.argv);

/** @type {import('./bot-player.js').BotRunStats[]} */
const results = [];

for (let i = 0; i < seeds; i++) {
  const seed = `${seedPrefix}-${i}`;
  const network = generateNetwork(seed, tc, mc);
  const stats = runBot(network, seed);
  results.push(stats);
}

printReport(results, tc, mc, seeds, seedPrefix);
