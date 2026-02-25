// ── CHEAT COMMANDS — development/playtesting only ────────
// These commands are intentionally separate from game logic so they can be
// gated, disabled, or penalized as a unit in future builds.
// Any use of a cheat command sets state.isCheating = true for the run.

import { getState, setCheating, forceGlobalAlert, revealNeighbors, accessNeighbors } from "./state.js";
import { addLogEntry } from "./log-renderer.js";
import { generateExploit } from "./exploits.js";

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

  if (what === "card") {
    const rarity = VALID_RARITIES.includes(args[1]) ? args[1] : null;
    const card = generateExploit(rarity);
    const s = getState();
    s.player.hand.push(card);
    activateCheat();
    addLogEntry(`CHEAT: Added ${card.rarity} exploit "${card.name}" to hand.`, "success");
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
    addLogEntry(`CHEAT: Added ¥${amount.toLocaleString()} to wallet.`, "success");
    return true;
  }

  addLogEntry("Usage: cheat give card [common|uncommon|rare]  |  cheat give cash <amount>", "error");
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
    addLogEntry(`CHEAT: Global alert forced to ${level.toUpperCase()}.`, "success");
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
  node.visibility = "accessible";
  revealNeighbors(node.id);
  accessNeighbors(node.id);
  activateCheat();
  addLogEntry(`CHEAT: ${node.label} set to OWNED.`, "success");
  return true;
}

// CHEAT: help
function cheatHelp() {
  const lines = [
    "[CHEAT] Playtesting only. Cheaters never win.",
    "  cheat give card [rarity]  Add exploit card. Rarities: common uncommon rare",
    "  cheat give cash <amount>  Add credits to wallet.",
    "  cheat set alert <level>   Force alert level: green yellow red trace",
    "  cheat own <node>          Set node to owned + reveal neighbors.",
  ];
  lines.forEach((line) => addLogEntry(line, "meta"));
  return true;
}

// ── Internal ──────────────────────────────────────────────

function activateCheat() {
  setCheating();
}
