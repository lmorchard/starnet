// @ts-check
// Starnet headless playtest harness — single-command REPL interface.
//
// State persists between invocations in a JSON file. Each call loads state,
// runs one command, prints all events/output, saves state, and exits.
//
// Usage:
//   node scripts/playtest.js reset
//   node scripts/playtest.js "probe gateway"
//   node scripts/playtest.js "exploit ids-1 2"
//   node scripts/playtest.js "tick 10"
//   node scripts/playtest.js --state scenario.json reset
//   node scripts/playtest.js --state scenario.json "status"

import { readFileSync, writeFileSync, existsSync } from "fs";
import {
  initHeadlessEngine, resetGame,
  getState, serializeState, deserializeState,
  tick, on, emitEvent, E,
} from "./lib/headless-engine.js";
import { buildNetwork as buildCorporateFoothold } from "../data/networks/corporate-foothold.js";
import { buildNetwork as buildResearchStation } from "../data/networks/research-station.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";
import { buildNetwork as buildGenerated } from "../data/networks/generated.js";
import { A } from "../js/core/action-ids.js";
import { addLogEntry } from "../js/core/log.js";
import { runCommand } from "../js/ui/console.js";
import { handleCheatCommand } from "../js/core/cheats.js";
import { initDynamicActions } from "../js/core/console-commands/dynamic-actions.js";
import { buildSetPieceMiniNetwork, buildMiniNetwork, listSetPieces } from "../js/core/node-graph/mini-network.js";

// ── Arg parsing ────────────────────────────────────────────

let stateFile = "scripts/playtest-state.json";
let cmdStr = null;
let seedArg = null;
let networkArg = null;
let pieceArg = null;
let graphFileArg = null;
let generatedArg = false;
let threatArg = "C", wealthArg = "B", complexityArg = "C", depthArg = "C";
let recipeArg = null, lanGradeArg = null;

{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--state" && argv[i + 1]) {
      stateFile = argv[++i];
    } else if (argv[i] === "--seed" && argv[i + 1]) {
      seedArg = argv[++i];
    } else if (argv[i] === "--network" && argv[i + 1]) {
      networkArg = argv[++i];
    } else if (argv[i] === "--piece" && argv[i + 1]) {
      pieceArg = argv[++i];
    } else if (argv[i] === "--graph" && argv[i + 1]) {
      graphFileArg = argv[++i];
    } else if (argv[i] === "--generated" || argv[i] === "-g") {
      generatedArg = true;
    } else if (argv[i] === "--threat" && argv[i + 1]) {
      threatArg = argv[++i];
    } else if (argv[i] === "--wealth" && argv[i + 1]) {
      wealthArg = argv[++i];
    } else if (argv[i] === "--complexity" && argv[i + 1]) {
      complexityArg = argv[++i];
    } else if (argv[i] === "--depth" && argv[i + 1]) {
      depthArg = argv[++i];
    } else if (argv[i] === "--recipe" && argv[i + 1]) {
      recipeArg = argv[++i];
    } else if (argv[i] === "--lan-grade" && argv[i + 1]) {
      lanGradeArg = argv[++i];
    } else if (cmdStr === null) {
      cmdStr = argv[i];
    }
  }
}

// ── Network selection ───────────────────────────────────────
const GRAPH_NETWORKS = {
  "corporate-foothold": buildCorporateFoothold,
  "research-station": buildResearchStation,
  "corporate-exchange": buildCorporateExchange,
};

let buildNetworkFn;
if (generatedArg) {
  // Procedural generation mode
  const genSeed = seedArg ?? `gen-${Date.now()}`;
  const spec = { threat: threatArg, wealth: wealthArg, complexity: complexityArg, depth: depthArg };
  if (recipeArg) spec.recipeId = recipeArg;
  if (lanGradeArg) spec.lanGrade = lanGradeArg;
  const result = buildGenerated({ seed: genSeed, spec });
  buildNetworkFn = () => result;
} else if (pieceArg) {
  // Set-piece mode: wrap in mini-network
  const available = listSetPieces();
  if (!available.includes(pieceArg)) {
    console.error(`Unknown set-piece: ${pieceArg}. Available: ${available.join(", ")}`);
    process.exit(1);
  }
  buildNetworkFn = () => buildSetPieceMiniNetwork(pieceArg);
} else if (graphFileArg) {
  // Ad-hoc JSON mode: load file and wrap
  const graphJson = JSON.parse(readFileSync(graphFileArg, "utf-8"));
  buildNetworkFn = () => buildMiniNetwork(graphJson, { name: `File: ${graphFileArg}` });
} else {
  // Standard network mode
  const selectedNetwork = networkArg ?? "corporate-foothold";
  buildNetworkFn = GRAPH_NETWORKS[selectedNetwork];
  if (!buildNetworkFn) {
    console.error(`Unknown network: ${selectedNetwork}. Available: ${Object.keys(GRAPH_NETWORKS).join(", ")}, --generated`);
    process.exit(1);
  }
}

if (!cmdStr) {
  console.error("Usage: node scripts/playtest.js [--state <file>] [--seed <s>] [--time <grade>] [--money <grade>] [--force-piece <id>] <command>");
  console.error("Commands: reset  tick <n>  target <node>  untarget");
  console.error("          probe [node]  xploit <node> <card>  dump [node]");
  console.error("          fetch [node]  corrupt [node]  jackout");
  console.error("          abort  eject  reboot [node]  cancel-trace");
  console.error("          status [summary|full|ice|hand|node|alert|mission]");
  console.error("          actions  log [n]  help  cheat ...");
  process.exit(1);
}

// ── Engine init ─────────────────────────────────────────────

initHeadlessEngine({
  openDarknetsStore: () => addLogEntry("[DARKNET] Use 'store' and 'buy' commands in the harness.", "meta"),
});

// ── Event → output ─────────────────────────────────────────

const lines = [];
function out(msg) { lines.push(String(msg)); }

// All LOG_ENTRY events → output (covers console.js command output + direct emits)
on(E.LOG_ENTRY, ({ text }) => out(text));

// Game events not covered by log-renderer (which isn't loaded in the harness)
on(E.NODE_ALERT_RAISED,    ({ label, prev, next })     => out(`[NODE] ${label}: alert ${prev} → ${next}.`));
on(E.NODE_ACCESSED,        ({ label, prev, next })     => out(`[NODE] ${label}: ${prev} → ${next.toUpperCase()}.`));
on(E.NODE_REVEALED,        ({ label, unlocked })       => { if (unlocked) out(`[NODE] ${label}: node accessible.`); });
// Timed action lifecycle
on(E.ACTION_FEEDBACK, ({ nodeId, action, phase, durationTicks }) => {
  const s = getState();
  const label = s.nodes[nodeId]?.label ?? nodeId;
  if (phase === "start") {
    const secs = Math.round((durationTicks ?? 0) / 10);
    out(`[${action.toUpperCase()}] ${label}: ${action === A.XPLOIT ? "executing" : "running"} (${secs}s)...`);
  } else if (phase === "cancel") {
    out(`[${action.toUpperCase()}] ${label}: cancelled.`);
  }
});
// Action resolutions
on(E.ACTION_RESOLVED, ({ action, label, success, detail }) => {
  if (action === A.PROBE) out(`[NODE] ${label}: vulnerabilities scanned.`);
  else if (action === A.XPLOIT) {
    const d = detail ?? {};
    out(`[EXPLOIT] ${label} — ${d.exploitName}: ${success ? "SUCCESS" : "FAIL"} (roll ${d.roll} vs ${d.successChance}%)`);
  }
  else if (action === A.DUMP) out(`[NODE] ${label}: ${detail?.macguffinCount ?? 0} item(s) found.`);
  else if (action === A.FETCH) out(`[NODE] ${label}: looted ${detail?.items} item(s) — ¥${(detail?.total ?? 0).toLocaleString()}.`);
  else if (action === A.CORRUPT) out(`[NODE] ${label}: event forwarding disabled.`);
  else if (action === "reboot-start") out(`[NODE] ${label}: rebooting.`);
  else if (action === "reboot-complete") out(`[NODE] ${label}: online.`);
});
on(E.EXPLOIT_DISCLOSED,    ({ exploitName })           => out(`[EXPLOIT] ${exploitName}: disclosed.`));
on(E.EXPLOIT_PARTIAL_BURN, ({ exploitName, usesRemaining }) =>
  out(`[EXPLOIT] ${exploitName}: partial burn (${usesRemaining} uses left).`));
on(E.ALERT_GLOBAL_RAISED,  ({ prev, next })            => out(`[ALERT] Global: ${prev} → ${next.toUpperCase()}`));
on(E.ALERT_TRACE_STARTED,   ({ seconds })               => out(`[ALERT] ⚠ TRACE INITIATED — ${seconds}s`));
on(E.ALERT_TRACE_CANCELLED, ()                          => out(`[ALERT] Trace cancelled. Alert: RED`));
on(E.ALERT_PROPAGATED,     ({ fromLabel, toLabel })    => out(`[ALERT] ${fromLabel} → ${toLabel}: alert propagated.`));
on(E.ICE_MOVED,            ({ fromLabel, toLabel, fromVisible, toVisible }) => {
  if (fromVisible || toVisible) out(`[ICE] Moving: ${fromLabel} → ${toLabel}`);
});
on(E.ICE_DETECTED,         ({ label })                 => out(`[ICE] ⚠ Detected at ${label}.`));
on(E.ICE_EJECTED,          ({ fromId, toId })          => out(`[ICE] Ejected: ${fromId} → ${toId}.`));
on(E.ICE_REBOOTED,         ({ residentLabel })         => out(`[ICE] Rebooted to ${residentLabel}.`));
on(E.ICE_DISABLED,         ()                          => out(`[ICE] Disabled.`));
on(E.MISSION_STARTED,      ({ targetName })            => out(`[MISSION] Target: ${targetName}`));
on(E.MISSION_COMPLETE,     ({ targetName })            => out(`[MISSION] ★ Complete: ${targetName}`));
on(E.RUN_ENDED,            ({ outcome })               => out(`[RUN] ${outcome.toUpperCase()}`));

// ── Main dispatch ──────────────────────────────────────────

function runCmd(raw) {
  const tokens = raw.trim().split(/\s+/);
  const verb = tokens[0].toLowerCase();
  const args = tokens.slice(1);

  // Harness-only commands
  if (verb === "reset") {
    resetGame(() => buildNetworkFn(), seedArg ?? undefined);
    const s = getState();
    const nodeCount = Object.keys(s.nodes).length;
    const networkName = generatedArg ? `generated (${threatArg}/${wealthArg}/${complexityArg}/${depthArg})` : pieceArg ? `piece:${pieceArg}` : graphFileArg ? `file:${graphFileArg}` : (networkArg ?? "corporate-foothold");
    out(`[SYS] Initialized. Seed: "${s.seed}". Network: ${nodeCount} nodes (${networkName}).`);
    return;
  }
  if (verb === "tick") {
    const n = Math.max(1, parseInt(args[0] ?? "1", 10) || 1);
    tick(n);
    out(`[SYS] Advanced ${n} tick(s).`);
    return;
  }

  // Cheat commands: bypass console.js's lazy dynamic import, call cheats directly
  if (verb === "cheat") {
    handleCheatCommand(args);
    return;
  }

  // All other commands delegate to console.js (status, actions, exploit, etc.)
  runCommand(raw);
}

// ── Load state ─────────────────────────────────────────────

const isReset = cmdStr.trim().toLowerCase() === "reset";
if (!isReset) {
  if (existsSync(stateFile)) {
    try {
      deserializeState(JSON.parse(readFileSync(stateFile, "utf8")));
      initDynamicActions();
      // Emit STATE_CHANGED so dynamic actions sync for the restored state
      emitEvent(E.STATE_CHANGED, getState());
    } catch (e) {
      out(`[SYS] Failed to load ${stateFile}: ${e.message}. Initializing fresh.`);
      resetGame(() => buildNetworkFn(), seedArg ?? undefined);
    }
  } else {
    out(`[SYS] No state file at ${stateFile}. Initializing fresh.`);
    resetGame(() => buildNetworkFn(), seedArg ?? undefined);
  }
}

// ── Run and save ───────────────────────────────────────────

runCmd(cmdStr);

try {
  writeFileSync(stateFile, JSON.stringify(serializeState(), null, 2));
} catch (e) {
  out(`[SYS] Failed to save state: ${e.message}`);
}

lines.forEach((line) => console.log(line));
