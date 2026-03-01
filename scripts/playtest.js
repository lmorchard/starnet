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
import { NETWORK } from "../data/network.js";
import { initState, serializeState, deserializeState } from "../js/state.js";
import { completeReboot } from "../js/node-orchestration.js";
import { handleExploitExecTimer, handleExploitNoiseTimer } from "../js/exploit-exec.js";
import { handleProbeScanTimer } from "../js/probe-exec.js";
import { handleReadScanTimer } from "../js/read-exec.js";
import { startIce, handleIceTick, handleIceDetect } from "../js/ice.js";
import { on, E } from "../js/events.js";
import { tick, TIMER } from "../js/timers.js";
import { handleTraceTick } from "../js/alert.js";
import { initLog, addLogEntry } from "../js/log.js";
import { runCommand } from "../js/console.js";
import { handleCheatCommand } from "../js/cheats.js";
import { initNodeLifecycle } from "../js/node-lifecycle.js";
import { buildActionContext, initActionDispatcher } from "../js/action-context.js";

// alert.js registers NODE_ALERT_RAISED / NODE_RECONFIGURED listeners at module load
// (importing handleTraceTick above already loaded the module — no separate import needed)
initNodeLifecycle();

// ── Arg parsing ────────────────────────────────────────────

let stateFile = "scripts/playtest-state.json";
let cmdStr = null;
let seedArg = null;

{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--state" && argv[i + 1]) {
      stateFile = argv[++i];
    } else if (argv[i] === "--seed" && argv[i + 1]) {
      seedArg = argv[++i];
    } else if (cmdStr === null) {
      cmdStr = argv[i];
    }
  }
}

if (!cmdStr) {
  console.error("Usage: node scripts/playtest.js [--state <file>] <command>");
  console.error("Commands: reset  tick <n>  select <node>  deselect");
  console.error("          probe [node]  exploit <node> <card>  read [node]");
  console.error("          loot [node]  reconfigure [node]  jackout");
  console.error("          eject  reboot [node]  cancel-trace");
  console.error("          status [summary|full|ice|hand|node|alert|mission]");
  console.error("          actions  log [n]  help  cheat ...");
  process.exit(1);
}

// ── Timer wiring ───────────────────────────────────────────

on(TIMER.ICE_MOVE,        ()        => handleIceTick());
on(TIMER.ICE_DETECT,      (payload) => handleIceDetect(payload));
on(TIMER.TRACE_TICK,      ()        => handleTraceTick());
on(TIMER.REBOOT_COMPLETE, (payload) => completeReboot(payload.nodeId));
on(TIMER.EXPLOIT_EXEC,    (payload) => handleExploitExecTimer(payload));
on(TIMER.EXPLOIT_NOISE,   (payload) => handleExploitNoiseTimer(payload));
on(TIMER.PROBE_SCAN,      (payload) => handleProbeScanTimer(payload));
on(TIMER.READ_SCAN,       (payload) => handleReadScanTimer(payload));

// ── Action dispatcher ──────────────────────────────────────
// Same path as the browser: starnet:action → getAvailableActions guard → ActionDef.execute()

const ctx = {
  ...buildActionContext(),
  openDarknetsStore: () => addLogEntry("[DARKNET] Use 'store' and 'buy' commands in the harness.", "meta"),
};
initActionDispatcher(ctx);

// ── Event → output ─────────────────────────────────────────

const lines = [];
function out(msg) { lines.push(String(msg)); }

// Start the log buffer so getRecentLog() works (used by the 'log' command).
initLog();

// All LOG_ENTRY events → output (covers console.js command output + direct emits)
on(E.LOG_ENTRY, ({ text }) => out(text));

// Game events not covered by log-renderer (which isn't loaded in the harness)
on(E.NODE_PROBED,          ({ label })                 => out(`[NODE] ${label}: vulnerabilities scanned.`));
on(E.NODE_ALERT_RAISED,    ({ label, prev, next })     => out(`[NODE] ${label}: alert ${prev} → ${next}.`));
on(E.NODE_ACCESSED,        ({ label, prev, next })     => out(`[NODE] ${label}: ${prev} → ${next.toUpperCase()}.`));
on(E.NODE_REVEALED,        ({ label, unlocked })       => { if (unlocked) out(`[NODE] ${label}: node accessible.`); });
on(E.NODE_READ,            ({ label, macguffinCount }) => out(`[NODE] ${label}: ${macguffinCount} item(s) found.`));
on(E.NODE_LOOTED,          ({ label, items, total })   => out(`[NODE] ${label}: looted ${items} item(s) — ¥${total.toLocaleString()}.`));
on(E.NODE_REBOOTING,       ({ label })                 => out(`[NODE] ${label}: rebooting.`));
on(E.NODE_REBOOTED,        ({ label })                 => out(`[NODE] ${label}: online.`));
on(E.PROBE_SCAN_STARTED,   ({ label, durationMs }) =>
  out(`[PROBE] ${label}: scanning (${Math.round(durationMs / 1000)}s)...`));
on(E.PROBE_SCAN_CANCELLED, ({ label }) => out(`[PROBE] ${label}: scan cancelled.`));
on(E.READ_SCAN_STARTED,    ({ label, durationMs }) =>
  out(`[READ] ${label}: extracting data (${Math.round(durationMs / 1000)}s)...`));
on(E.READ_SCAN_CANCELLED,  ({ label }) => out(`[READ] ${label}: extraction cancelled.`));
on(E.EXPLOIT_STARTED,      ({ label, exploitName, durationMs }) =>
  out(`[EXPLOIT] ${label} — ${exploitName}: executing (${Math.round(durationMs / 1000)}s)...`));
on(E.EXPLOIT_INTERRUPTED,  ({ exploitName }) => out(`[EXPLOIT] ${exploitName}: interrupted.`));
on(E.EXPLOIT_SUCCESS,      ({ label, exploitName, roll, successChance }) =>
  out(`[EXPLOIT] ${label} — ${exploitName}: SUCCESS (roll ${roll} vs ${successChance}%)`));
on(E.EXPLOIT_FAILURE,      ({ label, exploitName, roll, successChance }) =>
  out(`[EXPLOIT] ${label} — ${exploitName}: FAIL (roll ${roll} vs ${successChance}%)`));
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
    initState(NETWORK, seedArg ?? undefined);
    startIce();
    out(`[SYS] Initialized. Seed: "${getState().seed}". Network: ${NETWORK.nodes.length} nodes.`);
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
    } catch (e) {
      out(`[SYS] Failed to load ${stateFile}: ${e.message}. Initializing fresh.`);
      initState(NETWORK, seedArg ?? undefined);
      startIce();
    }
  } else {
    out(`[SYS] No state file at ${stateFile}. Initializing fresh.`);
    initState(NETWORK, seedArg ?? undefined);
    startIce();
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
