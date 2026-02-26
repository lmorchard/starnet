// Node.js playtest harness — runs a simulated game session and prints a transcript.
// Usage: node scripts/playtest.js

import { NETWORK } from "../data/network.js";
import { initState, getState, selectNode, probeNode, readNode, lootNode, endRun, completeReboot } from "../js/state.js";
import { launchExploit } from "../js/combat.js";
import { startIce, handleIceTick, handleIceDetect } from "../js/ice.js";
import { on, E } from "../js/events.js";
import "../js/alert.js"; // registers alert event listeners at module load

// ── Timer wiring ──────────────────────────────────────────
on("starnet:timer:ice-move",        ()        => handleIceTick());
on("starnet:timer:ice-detect",      (payload) => handleIceDetect(payload));
on("starnet:timer:reboot-complete", (payload) => completeReboot(payload.nodeId));

// ── Transcript log ────────────────────────────────────────
let turnCount = 0;

function log(msg) { console.log(msg); }

// Listen to typed game events directly (no log-renderer.js needed in Node.js)
on(E.NODE_PROBED,        ({ label }) => log(`  [NODE] ${label}: vulnerabilities scanned.`));
on(E.NODE_ALERT_RAISED,  ({ label, prev, next }) => log(`  [NODE] ${label}: alert ${prev} → ${next}.`));
on(E.NODE_ACCESSED,      ({ label, prev, next }) => log(`  [NODE] ${label}: ${prev} → ${next.toUpperCase()}.`));
on(E.NODE_READ,          ({ label, macguffinCount }) => log(`  [NODE] ${label}: ${macguffinCount} item(s) found.`));
on(E.NODE_LOOTED,        ({ label, items, total }) => log(`  [NODE] ${label}: looted ${items} item(s) — ¥${total.toLocaleString()}.`));
on(E.EXPLOIT_SUCCESS,    ({ label, exploitName, roll, successChance }) =>
  log(`  [EXPLOIT] ${label} — ${exploitName}: SUCCESS (roll ${roll} vs ${successChance}%)`));
on(E.EXPLOIT_FAILURE,    ({ label, exploitName, roll, successChance }) =>
  log(`  [EXPLOIT] ${label} — ${exploitName}: FAIL (roll ${roll} vs ${successChance}%)`));
on(E.EXPLOIT_DISCLOSED,  ({ exploitName }) => log(`  [EXPLOIT] ${exploitName}: burned.`));
on(E.EXPLOIT_PARTIAL_BURN, ({ exploitName, usesRemaining }) =>
  log(`  [EXPLOIT] ${exploitName}: partial burn (${usesRemaining} uses left).`));
on(E.ALERT_GLOBAL_RAISED, ({ prev, next }) => log(`  [ALERT] Global: ${prev} → ${next.toUpperCase()}`));
on(E.ALERT_TRACE_STARTED, ({ seconds }) => log(`  [ALERT] ⚠ TRACE INITIATED — ${seconds}s`));
on(E.ICE_MOVED,          ({ fromLabel, toLabel, fromVisible, toVisible }) => {
  if (fromVisible || toVisible) log(`  [ICE] Moving: ${fromLabel} → ${toLabel}`);
});
on(E.ICE_DETECTED,       ({ label }) => log(`  [ICE] ⚠ Detected at ${label} — alert raised.`));
on(E.ICE_DISABLED,       () => log(`  [ICE] ICE disabled.`));
on(E.MISSION_COMPLETE,   ({ targetName }) => log(`  [MISSION] ★ Complete: ${targetName}`));

// ── Run end handler ───────────────────────────────────────
let runDone = false;
on(E.RUN_ENDED, ({ outcome }) => {
  runDone = true;
  const s = getState();
  const owned = Object.values(s.nodes).filter(n => n.accessLevel === "owned").length;
  const total = Object.values(s.nodes).length;
  log(`\n══ RUN ENDED: ${outcome.toUpperCase()} ══`);
  log(`  Turns:      ${turnCount}`);
  log(`  Nodes owned: ${owned}/${total}`);
  log(`  Cash:       ¥${s.player.cash.toLocaleString()}`);
  log(`  Mission:    ${s.mission?.complete ? "COMPLETE ★" : "FAILED"}`);
  log(`  Alert:      ${s.globalAlert.toUpperCase()}`);
  log(`  Cheating:   ${s.isCheating}`);
});

// ── Player logic ──────────────────────────────────────────

// Best usable card for a node: prefer matching vulns, then highest quality.
function bestCard(node) {
  const s = getState();
  const usable = s.player.hand.filter(
    c => c.decayState !== "disclosed" && c.usesRemaining > 0
  );
  if (usable.length === 0) return null;
  const knownVulnIds = node.vulnerabilities
    .filter(v => !v.patched && !v.hidden)
    .map(v => v.id);
  const matching = usable.filter(c =>
    c.targetVulnTypes.some(t => knownVulnIds.includes(t))
  );
  const pool = matching.length > 0 ? matching : usable;
  return pool.reduce((best, c) => c.quality > best.quality ? c : best);
}

function accessibleNodes() {
  const s = getState();
  return Object.values(s.nodes).filter(n => n.visibility === "accessible");
}

function playerTurn() {
  if (runDone) return;
  const s = getState();
  if (s.phase !== "playing") return;

  const accessible = accessibleNodes();

  // Priority 1: finish compromised nodes (exploit to owned)
  const compromised = accessible.filter(n => n.accessLevel === "compromised");
  // Priority 2: probe unprobed locked nodes
  const unprobed    = accessible.filter(n => n.accessLevel === "locked" && !n.probed);
  // Priority 3: exploit probed locked nodes
  const probed      = accessible.filter(n => n.accessLevel === "locked" && n.probed);

  let node = null;
  let action = null;

  if (compromised.length > 0) {
    node = compromised[0];
    action = "exploit";
  } else if (unprobed.length > 0) {
    node = unprobed[0];
    action = "probe";
  } else if (probed.length > 0) {
    node = probed[0];
    action = "exploit";
  } else {
    log("\n[PLAYER] No actionable targets. Jacking out.");
    endRun("success");
    return;
  }

  turnCount++;
  log(`\n── Turn ${turnCount}: ${node.label} [${node.grade}] ${node.accessLevel} ──`);
  selectNode(node.id);

  if (action === "probe") {
    log(`[PLAYER] probe ${node.label}`);
    probeNode(node.id);
    return;
  }

  const card = bestCard(node);
  if (!card) {
    log(`[PLAYER] No usable cards for ${node.label}. Skipping node.`);
    // Mark as un-targetable this run by treating it as if probed+stuck;
    // skip by not selecting it again (handled by priority: locked+probed with no cards)
    // Move on — force probe remaining unprobed nodes instead
    const nextUnprobed = accessible.find(n => n.accessLevel === "locked" && !n.probed);
    if (nextUnprobed) {
      log(`[PLAYER] probe ${nextUnprobed.label}`);
      selectNode(nextUnprobed.id);
      probeNode(nextUnprobed.id);
    } else {
      log("[PLAYER] Stuck — no cards and no unprobed nodes. Jacking out.");
      endRun("success");
    }
    return;
  }

  log(`[PLAYER] exploit ${node.label} with "${card.name}" (${card.rarity}, ${card.usesRemaining} uses)`);
  launchExploit(node.id, card.id);

  // If now owned, read and loot immediately
  const fresh = getState().nodes[node.id];
  if (fresh.accessLevel === "owned") {
    readNode(node.id);
    if (fresh.macguffins.some(m => !m.collected)) {
      lootNode(node.id);
    }
  }
}

// ── Main loop ─────────────────────────────────────────────

log("══ STARNET PLAYTEST ══");
log(`Network: ${NETWORK.nodes.length} nodes\n`);

initState(NETWORK);
startIce();

const MAX_TURNS = 60;
const TURN_INTERVAL_MS = 300;

const ticker = setInterval(() => {
  if (runDone || turnCount >= MAX_TURNS) {
    clearInterval(ticker);
    if (!runDone) {
      log(`\n[PLAYTEST] Turn limit (${MAX_TURNS}) reached. Forcing jackout.`);
      endRun("success");
    }
    return;
  }
  playerTurn();
}, TURN_INTERVAL_MS);
