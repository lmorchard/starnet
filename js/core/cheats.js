// @ts-check
// ── CHEAT COMMANDS — development/playtesting only ────────

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').GlobalAlertLevel} GlobalAlertLevel */
// These commands are intentionally separate from game logic so they can be
// gated, disabled, or penalized as a unit in future builds.
// Any use of a cheat command sets state.isCheating = true for the run.

import { getState, revealNeighbors, accessNeighbors } from "./state.js";
import { emitEvent, E } from "./events.js";
import { setNodeAccessLevel, setNodeAlertState, setNodeVisible } from "./state/node.js";
import { addCash, addCardToHand, applyCardDecay } from "./state/player.js";
import {
  damagePlayerHealth, damagePlayerDeck,
  setPlayerHealth, setPlayerDeckIntegrity,
} from "./player-orchestration.js";
import { setCheating } from "./state/game.js";
import { forceGlobalAlert, cancelTraceCountdown } from "./alert.js";
import { teleportIce } from "./ice.js";
import { activeIceInstances, hasActiveIce } from "./state/ice.js";
import { addLogEntry } from "./log.js";
import { generateExploit, generateExploitForVuln } from "./exploits.js";

const VALID_RARITIES = ["common", "uncommon", "rare"];
const VALID_ALERTS   = ["green", "yellow", "red", "trace"];

/**
 * Returns true if the command was handled (valid cheat verb), false if unknown.
 * @param {string[]} args
 * @param {{ saveGame?: (() => void) | null }} [opts] Browser-side callbacks; omit in headless contexts.
 */
export function handleCheatCommand(args, { saveGame = null } = {}) {
  const sub = args[0]?.toLowerCase();

  if (sub === "give") {
    return cheatGive(args.slice(1));
  } else if (sub === "alert") {
    return cheatAlert(args.slice(1));
  } else if (sub === "own") {
    return cheatOwn(args.slice(1));
  } else if (sub === "own-all") {
    return cheatOwnAll();
  } else if (sub === "hurt") {
    return cheatHurt(args.slice(1));
  } else if (sub === "heal") {
    return cheatHeal(args.slice(1));
  } else if (sub === "trace") {
    return cheatTrace(args.slice(1));
  } else if (sub === "summon-ice" || sub === "teleport-ice") {
    return cheatSummonIce(args.slice(1));
  } else if (sub === "ice-state") {
    return cheatIceState();
  } else if (sub === "snapshot") {
    if (saveGame) {
      saveGame();
    } else {
      addLogEntry("[CHEAT] snapshot: not available in this context.", "error");
    }
    return true;
  } else if (sub === "help") {
    return cheatHelp();
  } else {
    addLogEntry(`Unknown cheat: ${args.join(" ")}. Run "cheat help" for usage.`, "error");
    return false;
  }
}

// CHEAT: give card [rarity] | give cash <amount>
function cheatGive(args) {
  const what = args[0]?.toLowerCase();

  if (what === "matching") {
    const token = args[1];
    const s = getState();
    let node = null;
    if (token) {
      const lower = token.toLowerCase();
      node = s.nodes[token] || Object.values(s.nodes).find((n) => n.label.toLowerCase().startsWith(lower));
    } else {
      node = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
    }
    if (!node) {
      addLogEntry("No node selected. Usage: cheat give matching [nodeId]", "error");
      return false;
    }
    if (!node.probed) {
      addLogEntry(`[CHEAT] ${node.label}: probe the node first to reveal vulnerabilities.`, "error");
      return false;
    }
    const targets = node.vulnerabilities.filter((v) => !v.patched && !v.hidden);
    if (targets.length === 0) {
      addLogEntry(`[CHEAT] ${node.label}: no unpatched vulnerabilities to match.`, "error");
      return false;
    }
    targets.forEach((v) => {
      const spent = s.player.hand.find(
        (c) => c.targetVulnTypes.includes(v.id) && (c.usesRemaining <= 0 || c.decayState === "disclosed")
      );
      if (spent) {
        restoreCard(spent);
        addLogEntry(`[CHEAT] Restored "${spent.name}" (${v.id}) — uses reset.`, "success");
      } else {
        const card = generateExploitForVuln(v.id);
        addCardToHand(card);
        addLogEntry(`[CHEAT] Added ${card.rarity} exploit "${card.name}" targeting ${v.id}.`, "success");
      }
    });
    activateCheat();
    return true;
  }

  if (what === "card") {
    const rarity = VALID_RARITIES.includes(args[1]) ? args[1] : null;
    const card = generateExploit(rarity);
    addCardToHand(card);
    activateCheat();
    addLogEntry(`[CHEAT] Added ${card.rarity} exploit "${card.name}" to hand.`, "success");
    return true;
  }

  if (what === "cash") {
    const amount = parseInt(args[1], 10);
    if (isNaN(amount) || amount <= 0) {
      addLogEntry("Usage: cheat give cash <amount>", "error");
      return false;
    }
    addCash(amount);
    activateCheat();
    addLogEntry(`[CHEAT] Added ¥${amount.toLocaleString()} to wallet.`, "success");
    return true;
  }

  addLogEntry("Usage: cheat give matching [nodeId]  |  cheat give card [rarity]  |  cheat give cash <amount>", "error");
  return false;
}

// CHEAT: alert <set <level> | raise | lower>
function cheatAlert(args) {
  const verb = args[0]?.toLowerCase();

  if (verb === "set") {
    const level = args[1]?.toLowerCase();
    if (!VALID_ALERTS.includes(level)) {
      addLogEntry("Usage: cheat alert set <green|yellow|red|trace>", "error");
      return false;
    }
    applyAlertLevel(level);
    addLogEntry(`[CHEAT] Global alert set to ${level.toUpperCase()}.`, "success");
    return true;
  }

  if (verb === "raise" || verb === "lower") {
    const cur = getState()?.globalAlert ?? "green";
    const idx = VALID_ALERTS.indexOf(cur);
    const nextIdx = verb === "raise"
      ? Math.min(idx + 1, VALID_ALERTS.length - 1)
      : Math.max(idx - 1, 0);
    const level = VALID_ALERTS[nextIdx];
    applyAlertLevel(level);
    addLogEntry(`[CHEAT] Global alert ${verb}d: ${cur.toUpperCase()} → ${level.toUpperCase()}.`, "success");
    return true;
  }

  addLogEntry("Usage: cheat alert <set <green|yellow|red|trace> | raise | lower>", "error");
  return false;
}

/**
 * Force the global alert to a level (cheat bypass of the escalate-only rule). When dropping
 * below trace, cancel the running trace countdown first — otherwise forceGlobalAlert lowers the
 * displayed level but leaves the trace timer ticking toward a loss.
 * @param {string} level
 */
function applyAlertLevel(level) {
  activateCheat();
  if (level !== "trace" && getState()?.traceSecondsRemaining != null) {
    cancelTraceCountdown(); // stop the in-flight trace before settling on a lower level
  }
  forceGlobalAlert(level);
}

// Resolve a pool token to its state key, label, and orchestration mutators.
function resolvePool(token) {
  switch (token?.toLowerCase()) {
    case "health": case "hp": case "h":
      return { key: "health", label: "HEALTH", damage: damagePlayerHealth, set: setPlayerHealth };
    case "deck": case "integrity": case "d":
      return { key: "deckIntegrity", label: "DECK", damage: damagePlayerDeck, set: setPlayerDeckIntegrity };
    default:
      return null;
  }
}

// CHEAT: hurt <health|deck> <amount> — deal damage (ends the run if it depletes the pool).
function cheatHurt(args) {
  const pool = resolvePool(args[0]);
  if (!pool) {
    addLogEntry("Usage: cheat hurt <health|deck> <amount>", "error");
    return false;
  }
  const amount = parseInt(args[1], 10);
  if (isNaN(amount) || amount <= 0) {
    addLogEntry(`Usage: cheat hurt ${args[0].toLowerCase()} <amount>`, "error");
    return false;
  }
  activateCheat();
  pool.damage(amount);
  const cur = getState().player[pool.key].current;
  addLogEntry(`[CHEAT] −${amount} ${pool.label} (${cur} left).`, "warning");
  emitEvent(E.STATE_CHANGED, getState());
  return true;
}

// CHEAT: heal <health|deck> [amount] — restore by amount, or to full if amount omitted.
function cheatHeal(args) {
  const pool = resolvePool(args[0]);
  if (!pool) {
    addLogEntry("Usage: cheat heal <health|deck> [amount]", "error");
    return false;
  }
  const p = getState().player[pool.key];
  let target;
  if (args[1] === undefined) {
    target = p.max; // full heal
  } else {
    const amount = parseInt(args[1], 10);
    if (isNaN(amount) || amount <= 0) {
      addLogEntry(`Usage: cheat heal ${args[0].toLowerCase()} [amount]`, "error");
      return false;
    }
    target = Math.min(p.max, p.current + amount);
  }
  activateCheat();
  pool.set(target);
  const cur = getState().player[pool.key].current;
  addLogEntry(`[CHEAT] ${pool.label} restored to ${cur}/${p.max}.`, "success");
  emitEvent(E.STATE_CHANGED, getState());
  return true;
}

// CHEAT: own <node>
function cheatOwn(args) {
  if (!args[0]) {
    addLogEntry("Usage: cheat own <node>", "error");
    return false;
  }
  const s = getState();
  const token = args[0].toLowerCase();
  const node =
    s.nodes[args[0]] ||
    Object.values(s.nodes).find((n) => n.label.toLowerCase().startsWith(token));

  if (!node) {
    addLogEntry(`Unknown node: ${args[0]}`, "error");
    return false;
  }

  const prev = node.accessLevel;
  setNodeAccessLevel(node.id, "owned");
  setNodeAlertState(node.id, "green");
  setNodeVisible(node.id, "accessible");
  emitEvent(E.NODE_ACCESSED, { nodeId: node.id, label: node.label, prev, next: "owned" });
  revealNeighbors(node.id);
  accessNeighbors(node.id);
  activateCheat();
  addLogEntry(`[CHEAT] ${node.label} set to OWNED.`, "success");
  return true;
}

// CHEAT: own-all — own every node, reveal the entire map
function cheatOwnAll() {
  const s = getState();
  let count = 0;
  for (const [id, node] of Object.entries(s.nodes)) {
    if (node.accessLevel === "owned") continue;
    const prev = node.accessLevel;
    setNodeAccessLevel(id, "owned");
    setNodeAlertState(id, "green");
    setNodeVisible(id, "accessible");
    emitEvent(E.NODE_ACCESSED, { nodeId: id, label: node.label, prev, next: "owned" });
    revealNeighbors(id);
    accessNeighbors(id);
    count++;
  }
  activateCheat();
  addLogEntry(`[CHEAT] ${count} node(s) set to OWNED. Full map revealed.`, "success");
  return true;
}

// CHEAT: summon-ice [nodeId]
function cheatSummonIce(args) {
  const s = getState();
  if (!hasActiveIce(s)) {
    addLogEntry("[CHEAT] No ICE active.", "error");
    return false;
  }
  const token = args[0] ?? s.selectedNodeId;
  if (!token) {
    addLogEntry("Usage: cheat summon-ice [nodeId]  (defaults to selected node)", "error");
    return false;
  }
  const lower = token.toLowerCase();
  const node = s.nodes[token] || Object.values(s.nodes).find((n) => n.label.toLowerCase().startsWith(lower));
  if (!node) {
    addLogEntry(`Unknown node: ${token}`, "error");
    return false;
  }
  activateCheat();
  teleportIce(node.id);
  addLogEntry(`[CHEAT] ICE summoned to ${node.label}.`, "success");
  return true;
}

// CHEAT: trace start | trace end
function cheatTrace(args) {
  const action = args[0]?.toLowerCase();

  if (action === "start") {
    const s = getState();
    if (s.traceSecondsRemaining !== null) {
      addLogEntry("[CHEAT] Trace already running.", "error");
      return false;
    }
    forceGlobalAlert("trace");
    activateCheat();
    addLogEntry("[CHEAT] Trace initiated.", "success");
    return true;
  }

  if (action === "end") {
    const s = getState();
    if (s.traceSecondsRemaining === null) {
      addLogEntry("[CHEAT] No trace active.", "error");
      return false;
    }
    cancelTraceCountdown();
    activateCheat();
    emitEvent(E.STATE_CHANGED, getState());
    addLogEntry("[CHEAT] Trace cancelled.", "success");
    return true;
  }

  addLogEntry("Usage: cheat trace start | cheat trace end", "error");
  return false;
}

// CHEAT: ice-state — read-only ICE diagnostic dump (no cheat flag)
function cheatIceState() {
  const s = getState();
  const ice = activeIceInstances(s)[0];
  if (!ice) {
    addLogEntry("[CHEAT] No ICE in this run.", "meta");
    return true;
  }
  const { grade, active, attentionNodeId, detectedAtNode } = ice;
  const label = s.nodes[attentionNodeId]?.label ?? attentionNodeId ?? "unknown";
  const disturbLabel = s.lastDisturbedNodeId
    ? (s.nodes[s.lastDisturbedNodeId]?.label ?? s.lastDisturbedNodeId)
    : "none";
  addLogEntry(`[ICE] grade:${grade}  active:${active}  node:${label}  detectedAt:${detectedAtNode ?? "none"}  disturbance:${disturbLabel}`, "meta");
  return true;
}

// CHEAT: help
function cheatHelp() {
  const lines = [
    "[CHEAT] Playtesting only. Cheaters never win.",
    "  cheat give matching [node]  Add exploits matching node's vulns (balance rescue).",
    "  cheat give card [rarity]    Add random exploit card. Rarities: common uncommon rare",
    "  cheat give cash <amount>    Add credits to wallet.",
    "  cheat alert set <level>     Force alert level: green yellow red trace",
    "  cheat alert raise|lower     Step the global alert up/down one level",
    "  cheat hurt <pool> <amount>  Damage health|deck (ends run if depleted).",
    "  cheat heal <pool> [amount]  Restore health|deck by amount, or to full.",
    "  cheat own <node>            Set node to owned + reveal neighbors.",
    "  cheat own-all               Own every node, reveal entire map.",
    "  cheat trace start           Start the 60s trace countdown immediately.",
    "  cheat trace end             Cancel active trace countdown.",
    "  cheat summon-ice [node]     Teleport ICE to node (default: selected). Resets dwell.",
    "  cheat ice-state             Dump raw ICE state: grade, position, disturbance target.",
    "  cheat relayout [algo]       Re-run layout. Try: dagre klay cola fcose cose-bilkent euler spread",
    "  cheat fps                   Toggle a frame-time / FPS meter (dev profiling).",
    "  cheat snapshot              Save game state to file.",
    "  cheat restore               Load game state from file.",
  ];
  lines.forEach((line) => addLogEntry(line, "meta"));
  return true;
}

// ── Internal ──────────────────────────────────────────────

const USES_BY_RARITY = { common: 3, uncommon: 5, rare: 8 };

function restoreCard(card) {
  applyCardDecay(card.id, USES_BY_RARITY[card.rarity] ?? 3, "fresh");
}

function activateCheat() {
  setCheating();
}
