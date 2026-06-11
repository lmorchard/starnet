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
  initHeadlessEngine, resetGame, wireRunHandlers,
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
let jsonMode = false;

{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") {
      jsonMode = true;
    } else if (argv[i] === "--state" && argv[i + 1]) {
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
  console.error("          fetch [node]  exec [<script>]  jackout");
  console.error("          abort  kick   reboot [node]");
  console.error("          status [summary|full|ice|hand|node|alert|mission]");
  console.error("          actions  log [n]  help  cheat ...");
  process.exit(1);
}

// ── Engine init ─────────────────────────────────────────────

initHeadlessEngine({
  openDarknetsStore: () => addLogEntry("[DARKNET] Use 'store' and 'buy' commands in the harness.", "meta"),
});

// ── Event → output ─────────────────────────────────────────

// In text mode: lines collects human-readable output, printed at end.
// In JSON mode: capturedEvents/capturedLog collect structured data for the envelope.
const lines = [];
/** @type {{ type: string, payload: any }[]} */
const capturedEvents = [];
/** @type {{ text: string, type: string }[]} */
const capturedLog = [];

function out(msg) {
  if (jsonMode) {
    capturedLog.push({ text: String(msg), type: "system" });
  } else {
    lines.push(String(msg));
  }
}

// LOG_ENTRY: always capture (text mode → lines, json mode → capturedLog)
on(E.LOG_ENTRY, ({ text, type }) => {
  if (jsonMode) {
    capturedLog.push({ text, type: type ?? "system" });
  } else {
    out(text);
  }
});

if (jsonMode) {
  // JSON mode: capture raw events into structured array
  const CAPTURE_EVENTS = [
    E.NODE_REVEALED, E.NODE_ACCESSED, E.NODE_ALERT_RAISED,
    E.EXPLOIT_DISCLOSED, E.EXPLOIT_PARTIAL_BURN, E.EXPLOIT_SURFACE,
    E.ALERT_GLOBAL_RAISED, E.ALERT_TRACE_STARTED, E.ALERT_TRACE_CANCELLED, E.ALERT_PROPAGATED,
    E.PLAYER_NAVIGATED,
    E.ICE_MOVED, E.ICE_DETECT_PENDING, E.ICE_DETECTED, E.ICE_EJECTED, E.ICE_REBOOTED, E.ICE_DISABLED, E.ICE_EFFECT_APPLIED,
    E.MISSION_STARTED, E.MISSION_COMPLETE,
    E.ACTION_FEEDBACK, E.ACTION_RESOLVED,
    E.RUN_STARTED, E.RUN_ENDED,
  ];
  for (const eventType of CAPTURE_EVENTS) {
    on(eventType, (payload) => {
      // Clone payload to avoid circular refs from live state objects
      try {
        capturedEvents.push({ type: eventType, payload: JSON.parse(JSON.stringify(payload)) });
      } catch {
        capturedEvents.push({ type: eventType, payload: String(payload) });
      }
    });
  }
} else {
  // Text mode: human-readable event handlers (same as before)
  on(E.NODE_ALERT_RAISED,    ({ label, prev, next })     => out(`[NODE] ${label}: alert ${prev} → ${next}.`));
  on(E.NODE_ACCESSED,        ({ label, prev, next })     => out(`[NODE] ${label}: ${prev} → ${next.toUpperCase()}.`));
  on(E.NODE_REVEALED,        ({ label, unlocked })       => { if (unlocked) out(`[NODE] ${label}: node accessible.`); });
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
  on(E.ICE_EFFECT_APPLIED,   ({ iceId, effect, result }) =>
    out(`[ICE] ${iceId} effect: ${effect}${result?.amount != null ? ` (${result.amount})` : ""}`));
  on(E.MISSION_STARTED,      ({ targetName })            => out(`[MISSION] Target: ${targetName}`));
  on(E.MISSION_COMPLETE,     ({ targetName })            => out(`[MISSION] ★ Complete: ${targetName}`));
  on(E.RUN_ENDED,            ({ outcome })               => out(`[RUN] ${outcome.toUpperCase()}`));
}

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
      // Restoring a serialized game still needs the full run-handler set wired —
      // action dispatcher, ICE/alert/timer handlers, dynamic actions — otherwise
      // dispatched commands (target, probe, …) and ticked timers no-op. resetGame()
      // does this via clearHandlers()+wireRunHandlers(); on the load path we wire
      // without clearing so the harness's own output listeners survive.
      wireRunHandlers();
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

if (jsonMode) {
  const envelope = {
    events: capturedEvents,
    state: serializeState(),
    log: capturedLog,
  };
  console.log(JSON.stringify(envelope, null, 2));
} else {
  lines.forEach((line) => console.log(line));
}
