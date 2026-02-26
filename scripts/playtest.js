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
import {
  initState, getState, selectNode, deselectNode, probeNode, readNode, lootNode,
  endRun, ejectIce, rebootNode, completeReboot, reconfigureNode,
  serializeState, deserializeState,
} from "../js/state.js";
import { launchExploit } from "../js/combat.js";
import { startIce, handleIceTick, handleIceDetect, cancelIceDwell } from "../js/ice.js";
import { on, E } from "../js/events.js";
import { tick, TIMER } from "../js/timers.js";
import { handleTraceTick, forceGlobalAlert, cancelTraceCountdown } from "../js/alert.js";
import { generateExploit, generateExploitForVuln } from "../js/exploits.js";
import { revealNeighbors, accessNeighbors, setCheating } from "../js/state.js";

// alert.js registers NODE_ALERT_RAISED / NODE_RECONFIGURED listeners at module load
// (importing handleTraceTick above already loaded the module — no separate import needed)

// ── Arg parsing ────────────────────────────────────────────

let stateFile = "scripts/playtest-state.json";
let cmdStr = null;

{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--state" && argv[i + 1]) {
      stateFile = argv[++i];
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
  console.error("          eject  reboot [node]");
  console.error("          status [summary|full|ice|hand|node|alert|mission]");
  console.error("          actions");
  process.exit(1);
}

// ── Timer wiring ───────────────────────────────────────────

on(TIMER.ICE_MOVE,        ()        => handleIceTick());
on(TIMER.ICE_DETECT,      (payload) => handleIceDetect(payload));
on(TIMER.TRACE_TICK,      ()        => handleTraceTick());
on(TIMER.REBOOT_COMPLETE, (payload) => completeReboot(payload.nodeId));

// ── Event → output ─────────────────────────────────────────

const lines = [];
function out(msg) { lines.push(String(msg)); }

on(E.LOG_ENTRY,            ({ text })                  => out(text));
on(E.NODE_PROBED,          ({ label })                 => out(`[NODE] ${label}: vulnerabilities scanned.`));
on(E.NODE_ALERT_RAISED,    ({ label, prev, next })     => out(`[NODE] ${label}: alert ${prev} → ${next}.`));
on(E.NODE_ACCESSED,        ({ label, prev, next })     => out(`[NODE] ${label}: ${prev} → ${next.toUpperCase()}.`));
on(E.NODE_REVEALED,        ({ label, unlocked })       => { if (unlocked) out(`[NODE] ${label}: node accessible.`); });
on(E.NODE_READ,            ({ label, macguffinCount }) => out(`[NODE] ${label}: ${macguffinCount} item(s) found.`));
on(E.NODE_LOOTED,          ({ label, items, total })   => out(`[NODE] ${label}: looted ${items} item(s) — ¥${total.toLocaleString()}.`));
on(E.NODE_REBOOTING,       ({ label })                 => out(`[NODE] ${label}: rebooting.`));
on(E.NODE_REBOOTED,        ({ label })                 => out(`[NODE] ${label}: online.`));
on(E.EXPLOIT_SUCCESS,      ({ label, exploitName, roll, successChance }) =>
  out(`[EXPLOIT] ${label} — ${exploitName}: SUCCESS (roll ${roll} vs ${successChance}%)`));
on(E.EXPLOIT_FAILURE,      ({ label, exploitName, roll, successChance }) =>
  out(`[EXPLOIT] ${label} — ${exploitName}: FAIL (roll ${roll} vs ${successChance}%)`));
on(E.EXPLOIT_DISCLOSED,    ({ exploitName })           => out(`[EXPLOIT] ${exploitName}: disclosed.`));
on(E.EXPLOIT_PARTIAL_BURN, ({ exploitName, usesRemaining }) =>
  out(`[EXPLOIT] ${exploitName}: partial burn (${usesRemaining} uses left).`));
on(E.ALERT_GLOBAL_RAISED,  ({ prev, next })            => out(`[ALERT] Global: ${prev} → ${next.toUpperCase()}`));
on(E.ALERT_TRACE_STARTED,  ({ seconds })               => out(`[ALERT] ⚠ TRACE INITIATED — ${seconds}s`));
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

// ── Node / card resolution ─────────────────────────────────

function resolveNode(token) {
  const s = getState();
  if (!token) return null;
  const lower = token.toLowerCase();
  const byId = s.nodes[token];
  if (byId && byId.visibility !== "hidden") return byId;
  const matches = Object.values(s.nodes).filter(
    (n) => n.visibility !== "hidden" && n.label.toLowerCase().startsWith(lower)
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) { out(`[ERR] Ambiguous node: ${matches.map((n) => n.id).join(", ")}`); return null; }
  out(`[ERR] Unknown node: ${token}`);
  return null;
}

function resolveImplicitNode() {
  const s = getState();
  if (!s.selectedNodeId || !s.nodes[s.selectedNodeId]) {
    out("[ERR] No node selected. Use: select <node>");
    return null;
  }
  return s.nodes[s.selectedNodeId];
}

function resolveCard(token) {
  const s = getState();
  if (!token) return null;
  const lower = token.toLowerCase();
  const num = parseInt(token, 10);
  if (!isNaN(num) && num >= 1 && num <= s.player.hand.length) return s.player.hand[num - 1] ?? null;
  const byId = s.player.hand.find((c) => c.id === token);
  if (byId) return byId;
  const matches = s.player.hand.filter(
    (c) => c.decayState !== "disclosed" && c.name.toLowerCase().startsWith(lower)
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) { out(`[ERR] Ambiguous card: ${matches.map((c) => c.name).join(", ")}`); return null; }
  out(`[ERR] Unknown card: ${token}`);
  return null;
}

// ── Command implementations ────────────────────────────────

function cmdSelect(args) {
  if (!args[0]) { out("[ERR] Usage: select <node>"); return; }
  const node = resolveNode(args[0]);
  if (!node) return;
  cancelIceDwell();
  selectNode(node.id);
}

function cmdProbe(args) {
  const node = args[0] ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  probeNode(node.id);
}

function cmdExploit(args) {
  const s = getState();
  let node, card;
  if (args.length >= 2) {
    node = resolveNode(args[0]);
    if (!node) return;
    card = resolveCard(args.slice(1).join(" "));
  } else if (args.length === 1 && s.selectedNodeId) {
    node = resolveImplicitNode();
    if (!node) return;
    card = resolveCard(args[0]);
  } else {
    out("[ERR] Usage: exploit <node> <card>  (or select a node first: exploit <card>)");
    return;
  }
  if (!card) return;
  launchExploit(node.id, card.id);
}

function cmdRead(args) {
  const node = args[0] ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  readNode(node.id);
}

function cmdLoot(args) {
  const node = args[0] ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  lootNode(node.id);
}

function cmdReconfigure(args) {
  const node = args[0] ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  reconfigureNode(node.id);
}

function cmdReboot(args) {
  const node = args[0] ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  if (node.accessLevel !== "owned") { out(`[ERR] ${node.label}: must be owned to reboot.`); return; }
  rebootNode(node.id);
}

function cmdEject() {
  const s = getState();
  if (!s.ice?.active || s.ice.attentionNodeId !== s.selectedNodeId) {
    out("[ERR] No ICE at selected node.");
    return;
  }
  ejectIce();
}

function cmdTick(args) {
  const n = Math.max(1, parseInt(args[0] ?? "1", 10) || 1);
  tick(n);
  out(`[SYS] Advanced ${n} tick(s).`);
}

// ── Status commands ────────────────────────────────────────

function cmdStatus(args) {
  const noun = (args[0] ?? "summary").toLowerCase();
  switch (noun) {
    case "summary": return printStatusSummary();
    case "full":    return printStatusFull();
    case "ice":     return printStatusIce();
    case "hand":    return printStatusHand();
    case "alert":   return printStatusAlert();
    case "mission": return printStatusMission();
    case "node":    return printStatusNode(args.slice(1));
    default:
      out(`[ERR] Unknown status noun: ${noun}. Try: summary full ice hand node alert mission`);
  }
}

function printStatusSummary() {
  const s = getState();
  const trace = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "--";
  out(`## STATUS`);
  if (s.phase === "ended") {
    out(`  !! RUN ENDED: ${(s.runOutcome ?? "unknown").toUpperCase()} !!`);
  }
  out(`  Alert: ${s.globalAlert.toUpperCase()}  Trace: ${trace}  Cash: ¥${s.player.cash.toLocaleString()}`);
  if (s.ice?.active) {
    const pos      = s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId;
    const resident = s.nodes[s.ice.residentNodeId]?.label  ?? s.ice.residentNodeId;
    out(`  ICE: ACTIVE [${s.ice.grade}] at ${pos} (resident: ${resident})`);
  } else {
    out(`  ICE: ${s.ice ? "INACTIVE" : "NONE"}`);
  }
  const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
  out(sel
    ? `  Selected: ${s.selectedNodeId}  [${sel.type}]  ${sel.accessLevel}  alert:${sel.alertState}`
    : `  Selected: none`
  );
  const nodes = Object.values(s.nodes);
  const accessible = nodes.filter((n) => n.visibility === "accessible").length;
  const owned      = nodes.filter((n) => n.accessLevel === "owned").length;
  const revealed   = nodes.filter((n) => n.visibility === "revealed").length;
  out(`  Network: ${accessible} accessible (${owned} owned)  ${revealed} revealed`);
  out(`  Hand: ${s.player.hand.length} cards`);
  if (s.mission) {
    out(`  Mission: ${s.mission.targetName}  — ${s.mission.complete ? "COMPLETE ★" : "not collected"}`);
  }
}

function printStatusFull() {
  const s = getState();
  out(`## STATUS (full)`);

  out(`### ALERT`);
  const trace = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "--";
  out(`- global: ${s.globalAlert.toUpperCase()}  trace: ${trace}`);

  out(`### ICE`);
  if (s.ice?.active) {
    const pos      = s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId;
    const resident = s.nodes[s.ice.residentNodeId]?.label  ?? s.ice.residentNodeId;
    out(`- ACTIVE  grade:${s.ice.grade}  at:${pos}  resident:${resident}  detections:${s.ice.detectionCount}`);
  } else {
    out(`- ${s.ice ? "INACTIVE" : "NONE"}`);
  }

  out(`### SELECTED`);
  if (s.selectedNodeId) {
    const sel = s.nodes[s.selectedNodeId];
    out(`- ${s.selectedNodeId}  [${sel.type}]  ${sel.accessLevel}  alert:${sel.alertState}`);
  } else {
    out(`- none`);
  }

  out(`### NETWORK`);
  const accessible = Object.values(s.nodes).filter((n) => n.visibility === "accessible");
  const revealedCount = Object.values(s.nodes).filter((n) => n.visibility === "revealed").length;
  accessible.forEach((node) => {
    const selMark   = node.id === s.selectedNodeId ? " [SELECTED]" : "";
    const probed    = node.probed ? " probed" : "";
    const rebooting = node.rebooting ? " REBOOTING" : "";
    out(`- ${node.id}  [${node.type}]  ${node.accessLevel}  alert:${node.alertState}${probed}${rebooting}${selMark}`);
    if (node.probed && node.vulnerabilities.length > 0) {
      const vulns = node.vulnerabilities
        .filter((v) => !v.hidden)
        .map((v) => `${v.id}${v.patched ? "(patched)" : ""}`)
        .join(", ");
      if (vulns) out(`  vulns: ${vulns}`);
    }
  });
  if (revealedCount > 0) out(`- ${revealedCount} revealed (inaccessible)`);

  out(`### HAND`);
  if (s.player.hand.length === 0) {
    out(`- (empty)`);
  } else {
    const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
    s.player.hand.forEach((card, i) => {
      const decay   = card.decayState !== "fresh" ? `  [${card.decayState.toUpperCase()}]` : "";
      const targets = card.targetVulnTypes.join(", ");
      let matchStr = "";
      if (sel?.probed) {
        const known = sel.vulnerabilities.filter((v) => !v.patched && !v.hidden).map((v) => v.id);
        matchStr = card.targetVulnTypes.some((t) => known.includes(t)) ? "  ✓" : "";
      }
      out(`- [${i + 1}] ${card.name}  ${card.rarity}  uses:${card.usesRemaining}  targets:${targets}${matchStr}${decay}`);
    });
  }

  out(`### MISSION`);
  if (s.mission) {
    out(`- target: ${s.mission.targetName}  complete: ${s.mission.complete ? "YES ★" : "no"}`);
  } else {
    out(`- none`);
  }

  out(`### PLAYER`);
  out(`- cash: ¥${s.player.cash.toLocaleString()}${s.isCheating ? "  cheating:YES" : ""}`);
}

function printStatusIce() {
  const s = getState();
  out(`## STATUS: ICE`);
  if (s.ice?.active) {
    const pos      = s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId;
    const resident = s.nodes[s.ice.residentNodeId]?.label  ?? s.ice.residentNodeId;
    out(`- ACTIVE  grade:${s.ice.grade}`);
    out(`- attention: ${pos}  resident: ${resident}`);
    out(`- detections: ${s.ice.detectionCount}`);
  } else {
    out(`- ${s.ice ? "INACTIVE" : "NONE"}`);
  }
}

function printStatusHand() {
  const s = getState();
  const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
  out(`## STATUS: HAND`);
  if (s.player.hand.length === 0) {
    out("- (empty)");
  } else {
    s.player.hand.forEach((card, i) => {
      const decay   = card.decayState !== "fresh" ? `  [${card.decayState.toUpperCase()}]` : "";
      const targets = card.targetVulnTypes.join(", ");
      let matchStr = "";
      if (sel?.probed) {
        const known = sel.vulnerabilities.filter((v) => !v.patched && !v.hidden).map((v) => v.id);
        matchStr = card.targetVulnTypes.some((t) => known.includes(t)) ? "  ✓" : "";
      }
      out(`- [${i + 1}] ${card.name}  ${card.rarity}  uses:${card.usesRemaining}  targets:${targets}${matchStr}${decay}`);
    });
  }
}

function printStatusAlert() {
  const s = getState();
  out(`## STATUS: ALERT`);
  const trace = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "--";
  out(`- global: ${s.globalAlert.toUpperCase()}  trace: ${trace}`);
  const secNodes = Object.values(s.nodes).filter(
    (n) => n.visibility !== "hidden" && (n.type === "ids" || n.type === "security-monitor")
  );
  secNodes.forEach((n) => {
    const fwd = n.type === "ids" ? (n.eventForwardingDisabled ? " [fwd:OFF]" : " [fwd:ON]") : "";
    out(`- ${n.id}  [${n.type}]  alert:${n.alertState}${fwd}`);
  });
}

function printStatusMission() {
  const s = getState();
  out(`## STATUS: MISSION`);
  if (!s.mission) { out("- none"); return; }
  out(`- target: ${s.mission.targetName}`);
  out(`- complete: ${s.mission.complete ? "YES ★" : "no"}`);
  for (const node of Object.values(s.nodes)) {
    const m = node.macguffins?.find((m) => m.id === s.mission.targetMacguffinId);
    if (m) {
      out(`- value: ¥${m.cashValue.toLocaleString()}`);
      out(`- location: ${node.label} (${node.id})`);
      out(`- collected: ${m.collected ? "YES" : "no"}`);
      break;
    }
  }
}

function printStatusNode(args) {
  const s = getState();
  const node = args[0] ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  out(`## STATUS: NODE ${node.id}`);
  out(`- label: ${node.label}  type: ${node.type}  grade: ${node.grade ?? "N/A"}`);
  out(`- access: ${node.accessLevel}  alert: ${node.alertState}`);
  out(`- visibility: ${node.visibility}  probed: ${node.probed}  read: ${node.read}  looted: ${node.looted}`);
  if (node.rebooting) out(`- REBOOTING`);
  if (node.type === "ids") out(`- event forwarding: ${node.eventForwardingDisabled ? "disabled" : "enabled"}`);
  if (node.probed && node.vulnerabilities.length > 0) {
    const vulns = node.vulnerabilities
      .filter((v) => !v.hidden)
      .map((v) => `${v.id}${v.patched ? "(patched)" : ""}`)
      .join(", ");
    if (vulns) out(`- vulns: ${vulns}`);
  }
  if (node.read && node.macguffins.length > 0) {
    node.macguffins.forEach((m) => {
      const mission = s.mission?.targetMacguffinId === m.id ? " [MISSION]" : "";
      out(`- item: ${m.name}  ¥${m.cashValue.toLocaleString()}${mission}  collected:${m.collected}`);
    });
  }
  if (s.ice?.active && s.ice.attentionNodeId === node.id) {
    out(`- ⚠ ICE present (grade: ${s.ice.grade})`);
  }
}

function cmdCheat(args) {
  const sub = args[0]?.toLowerCase();
  const s = getState();

  if (sub === "own") {
    const token = args[1];
    if (!token) { out("[ERR] Usage: cheat own <node>"); return; }
    const node = s.nodes[token] ?? Object.values(s.nodes).find((n) => n.label.toLowerCase().startsWith(token.toLowerCase()));
    if (!node) { out(`[ERR] Unknown node: ${token}`); return; }
    node.accessLevel = "owned";
    node.alertState  = "green";
    node.visibility  = "accessible";
    revealNeighbors(node.id);
    accessNeighbors(node.id);
    setCheating();
    out(`[CHEAT] ${node.label} set to OWNED.`);
    return;
  }

  if (sub === "give") {
    const what = args[1]?.toLowerCase();
    if (what === "matching") {
      const token = args[2];
      const node = token
        ? (s.nodes[token] ?? Object.values(s.nodes).find((n) => n.label.toLowerCase().startsWith(token.toLowerCase())))
        : (s.selectedNodeId ? s.nodes[s.selectedNodeId] : null);
      if (!node) { out("[ERR] No node. Use: cheat give matching <node>"); return; }
      if (!node.probed) { out(`[ERR] ${node.label}: probe first.`); return; }
      const targets = node.vulnerabilities.filter((v) => !v.patched && !v.hidden);
      if (targets.length === 0) { out(`[ERR] ${node.label}: no unpatched vulns.`); return; }
      const USES = { common: 3, uncommon: 5, rare: 8 };
      targets.forEach((v) => {
        const spent = s.player.hand.find((c) => c.targetVulnTypes.includes(v.id) && (c.usesRemaining <= 0 || c.decayState === "disclosed"));
        if (spent) {
          spent.usesRemaining = USES[spent.rarity] ?? 3;
          spent.decayState = "fresh";
          out(`[CHEAT] Restored "${spent.name}" (${v.id}).`);
        } else {
          const card = generateExploitForVuln(v.id);
          s.player.hand.push(card);
          out(`[CHEAT] Added "${card.name}" [${card.rarity}] targeting ${v.id}.`);
        }
      });
      setCheating();
      return;
    }
    if (what === "card") {
      const rarity = ["common", "uncommon", "rare"].includes(args[2]) ? args[2] : null;
      const card = generateExploit(rarity);
      s.player.hand.push(card);
      setCheating();
      out(`[CHEAT] Added "${card.name}" [${card.rarity}] to hand.`);
      return;
    }
    if (what === "cash") {
      const amount = parseInt(args[2], 10);
      if (isNaN(amount) || amount <= 0) { out("[ERR] Usage: cheat give cash <amount>"); return; }
      s.player.cash += amount;
      setCheating();
      out(`[CHEAT] Added ¥${amount.toLocaleString()} to wallet.`);
      return;
    }
    out("[ERR] Usage: cheat give matching|card|cash ...");
    return;
  }

  if (sub === "set" && args[1]?.toLowerCase() === "alert") {
    const level = args[2]?.toLowerCase();
    if (!["green","yellow","red","trace"].includes(level)) { out("[ERR] Usage: cheat set alert <green|yellow|red|trace>"); return; }
    forceGlobalAlert(level);
    setCheating();
    out(`[CHEAT] Alert forced to ${level.toUpperCase()}.`);
    return;
  }

  if (sub === "trace") {
    const action = args[1]?.toLowerCase();
    if (action === "end") {
      if (s.traceSecondsRemaining === null) { out("[ERR] No trace active."); return; }
      cancelTraceCountdown();
      setCheating();
      out("[CHEAT] Trace cancelled.");
      return;
    }
    if (action === "start") {
      forceGlobalAlert("trace");
      setCheating();
      out("[CHEAT] Trace initiated.");
      return;
    }
    out("[ERR] Usage: cheat trace start|end");
    return;
  }

  out("[ERR] Cheats: own <node>  give matching|card|cash  set alert <level>  trace start|end");
}

function cmdActions() {
  const s = getState();
  const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
  out(`## AVAILABLE ACTIONS`);
  out(`  jackout`);

  const accessible = Object.values(s.nodes)
    .filter((n) => n.visibility === "accessible" && !n.rebooting && n.id !== s.selectedNodeId);
  const revealed = Object.values(s.nodes)
    .filter((n) => n.visibility === "revealed" && n.id !== s.selectedNodeId);
  if (accessible.length > 0) out(`  select <nodeId>  — accessible: ${accessible.map((n) => n.id).join(", ")}`);
  if (revealed.length > 0)   out(`  select <nodeId>  — traverse: ${revealed.map((n) => n.id).join(", ")}`);

  if (sel) {
    out(`  deselect`);
    if (!sel.probed && !sel.rebooting) out(`  probe  — scan ${sel.id} for vulnerabilities`);
    if (sel.visibility === "accessible" && !sel.rebooting) {
      s.player.hand.forEach((card, i) => {
        const known = sel.probed
          ? sel.vulnerabilities.filter((v) => !v.patched && !v.hidden).map((v) => v.id)
          : [];
        const match = card.targetVulnTypes.some((t) => known.includes(t));
        const worn  = card.usesRemaining <= 0 ? " [WORN]" : "";
        const disc  = card.decayState === "disclosed" ? " [DISCLOSED]" : "";
        const matchStr = sel.probed ? (match ? " ✓" : "") : "";
        out(`  exploit ${i + 1}  — ${card.name} [${card.rarity}] targets:${card.targetVulnTypes.join(",")}${matchStr}${worn}${disc}`);
      });
    }
    if ((sel.accessLevel === "compromised" || sel.accessLevel === "owned") && !sel.read) {
      out(`  read`);
    }
    if (sel.accessLevel === "owned" && sel.read && sel.macguffins.some((m) => !m.collected)) {
      out(`  loot`);
    }
    if (sel.type === "ids" && !sel.eventForwardingDisabled && sel.accessLevel !== "locked") {
      out(`  reconfigure`);
    }
    if (s.ice?.active && s.ice.attentionNodeId === s.selectedNodeId) {
      out(`  eject`);
    }
    if (sel.accessLevel === "owned" && !sel.rebooting) {
      out(`  reboot`);
    }
  }
}

// ── Main dispatch ──────────────────────────────────────────

function runCmd(raw) {
  const tokens = raw.trim().split(/\s+/);
  const verb = tokens[0].toLowerCase();
  const args = tokens.slice(1);
  switch (verb) {
    case "reset":
      initState(NETWORK);
      startIce();
      out(`[SYS] Initialized. Network: ${NETWORK.nodes.length} nodes.`);
      break;
    case "tick":        cmdTick(args); break;
    case "select":      cmdSelect(args); break;
    case "deselect":    deselectNode(); break;
    case "probe":       cmdProbe(args); break;
    case "exploit":
    case "escalate":    cmdExploit(args); break;
    case "read":        cmdRead(args); break;
    case "loot":        cmdLoot(args); break;
    case "reconfigure": cmdReconfigure(args); break;
    case "jackout":     endRun("success"); break;
    case "eject":       cmdEject(); break;
    case "reboot":      cmdReboot(args); break;
    case "status":      cmdStatus(args); break;
    case "actions":     cmdActions(); break;
    case "cheat":       cmdCheat(args); break;
    default:
      out(`[ERR] Unknown command: ${verb}`);
  }
}

// ── Load state ─────────────────────────────────────────────

const isReset = cmdStr.trim().toLowerCase() === "reset";
if (!isReset) {
  if (existsSync(stateFile)) {
    try {
      deserializeState(JSON.parse(readFileSync(stateFile, "utf8")));
    } catch (e) {
      out(`[SYS] Failed to load ${stateFile}: ${e.message}. Initializing fresh.`);
      initState(NETWORK);
      startIce();
    }
  } else {
    out(`[SYS] No state file at ${stateFile}. Initializing fresh.`);
    initState(NETWORK);
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
