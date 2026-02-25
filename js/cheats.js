// @ts-check
// ── CHEAT COMMANDS — development/playtesting only ────────

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').GlobalAlertLevel} GlobalAlertLevel */
// These commands are intentionally separate from game logic so they can be
// gated, disabled, or penalized as a unit in future builds.
// Any use of a cheat command sets state.isCheating = true for the run.

import { getState, setCheating, revealNeighbors, accessNeighbors, emit } from "./state.js";
import { forceGlobalAlert, cancelTraceCountdown } from "./alert.js";
import { addLogEntry } from "./log-renderer.js";
import { generateExploit, generateExploitForVuln } from "./exploits.js";

const VALID_RARITIES = ["common", "uncommon", "rare"];
const VALID_ALERTS   = ["green", "yellow", "red", "trace"];

// Returns true if the command was handled (valid cheat verb), false if unknown.
export function handleCheatCommand(args) {
  const sub = args[0]?.toLowerCase();

  if (sub === "give") {
    return cheatGive(args.slice(1));
  } else if (sub === "set") {
    return cheatSet(args.slice(1));
  } else if (sub === "own") {
    return cheatOwn(args.slice(1));
  } else if (sub === "trace") {
    return cheatTrace(args.slice(1));
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
        s.player.hand.push(card);
        addLogEntry(`[CHEAT] Added ${card.rarity} exploit "${card.name}" targeting ${v.id}.`, "success");
      }
    });
    activateCheat();
    return true;
  }

  if (what === "card") {
    const rarity = VALID_RARITIES.includes(args[1]) ? args[1] : null;
    const card = generateExploit(rarity);
    const s = getState();
    s.player.hand.push(card);
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
    const s = getState();
    s.player.cash += amount;
    activateCheat();
    addLogEntry(`[CHEAT] Added ¥${amount.toLocaleString()} to wallet.`, "success");
    return true;
  }

  addLogEntry("Usage: cheat give matching [nodeId]  |  cheat give card [rarity]  |  cheat give cash <amount>", "error");
  return false;
}

// CHEAT: set alert <level>
function cheatSet(args) {
  const what = args[0]?.toLowerCase();

  if (what === "alert") {
    const level = args[1]?.toLowerCase();
    if (!VALID_ALERTS.includes(level)) {
      addLogEntry(`Usage: cheat set alert <green|yellow|red|trace>`, "error");
      return false;
    }
    activateCheat();
    forceGlobalAlert(level);
    addLogEntry(`[CHEAT] Global alert forced to ${level.toUpperCase()}.`, "success");
    return true;
  }

  addLogEntry("Usage: cheat set alert <green|yellow|red|trace>", "error");
  return false;
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

  node.accessLevel = "owned";
  node.alertState = "green";
  node.visibility = "accessible";
  revealNeighbors(node.id);
  accessNeighbors(node.id);
  activateCheat();
  addLogEntry(`[CHEAT] ${node.label} set to OWNED.`, "success");
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
    addLogEntry("[CHEAT] Trace cancelled.", "success");
    return true;
  }

  addLogEntry("Usage: cheat trace start | cheat trace end", "error");
  return false;
}

// CHEAT: help
function cheatHelp() {
  const lines = [
    "[CHEAT] Playtesting only. Cheaters never win.",
    "  cheat give matching [node]  Add exploits matching node's vulns (balance rescue).",
    "  cheat give card [rarity]    Add random exploit card. Rarities: common uncommon rare",
    "  cheat give cash <amount>    Add credits to wallet.",
    "  cheat set alert <level>     Force alert level: green yellow red trace",
    "  cheat own <node>            Set node to owned + reveal neighbors.",
    "  cheat trace start           Start the 60s trace countdown immediately.",
    "  cheat trace end             Cancel active trace countdown.",
  ];
  lines.forEach((line) => addLogEntry(line, "meta"));
  return true;
}

// ── Internal ──────────────────────────────────────────────

const USES_BY_RARITY = { common: 3, uncommon: 5, rare: 8 };

function restoreCard(card) {
  card.usesRemaining = USES_BY_RARITY[card.rarity] ?? 3;
  card.decayState = "fresh";
}

function activateCheat() {
  setCheating();
  emit();
}
