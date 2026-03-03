// @ts-check
// Console command registry.
//
// Each CommandDef owns its verb identity, tab-completion behaviour, AND execution
// logic in one place.  Adding a command means adding one entry to COMMANDS and
// calling registerCommand() — nothing else changes.
//
// The registry is open for extension: browser-side code (console.js) calls
// registerCommand() again to override commands that need DOM or UI modules.
// The headless cheat entry handles everything except `relayout` and `restore`,
// which are replaced by the browser extension in js/ui/console.js.
//
// tabComplete() and getCommand() read from the live registry Map, so overrides
// are picked up automatically.
//
// Testability: getCommand(verb).execute(args) is callable directly from tests
// without going through the full command-dispatch pipeline.

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').ExploitCard} ExploitCard */
/** @typedef {import('./types.js').NodeState} NodeState */

import { getState, isIceVisible } from "./state.js";
import { addLogEntry, getRecentLog } from "./log.js";
import { emitEvent, E } from "./events.js";
import { getVisibleTimers } from "./timers.js";
import { exploitSortKey, getStoreCatalog, VULNERABILITY_TYPES } from "./exploits.js";
import { getActions } from "./actions/node-types.js";
import { getAvailableActions } from "./actions/node-actions.js";
import { buyFromStore } from "./store-logic.js";

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * A console command: verb identity, optional tab-completion, optional execution.
 *
 * complete(args, partial, state):
 *   args    — committed tokens after the verb (lowercase), excluding partial
 *   partial — the token currently being typed
 *   state   — current game state (read-only)
 *   Returns { insertTexts, displayTexts } or null for "no completions here".
 *
 * execute(args):
 *   args — tokens after the verb (raw case preserved)
 *
 * @typedef {{
 *   verb: string,
 *   complete?: ((args: string[], partial: string, state: GameState) =>
 *     { insertTexts: string[], displayTexts: string[] } | null) | null,
 *   execute?: ((args: string[]) => void) | null,
 * }} CommandDef
 */

/** @type {Map<string, CommandDef>} */
const registry = new Map();

/**
 * Register (or replace) a command definition.
 * Called at module init for all core commands; called again by console.js to
 * override browser-specific sub-commands (e.g. cheat relayout/restore).
 * @param {CommandDef} def
 */
export function registerCommand(def) {
  registry.set(def.verb, def);
}

/**
 * Look up a command by verb.
 * @param {string} verb
 * @returns {CommandDef|undefined}
 */
export function getCommand(verb) {
  return registry.get(verb);
}

// ── Completion infrastructure ─────────────────────────────────────────────────

/** @param {string[]} strings @returns {string} */
function longestCommonPrefix(strings) {
  if (strings.length === 0) return "";
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) return "";
  }
  return prefix;
}

/**
 * Build a completion result from candidate insertTexts and (optional) displayTexts.
 * - Single match: complete immediately with trailing space.
 * - Multiple matches: show suggestions; complete to LCP if it improves on partial.
 * @param {string} prefix
 * @param {string} partial
 * @param {string[]} insertTexts
 * @param {string[]} [displayTexts]
 * @returns {{ completed: string|null, suggestions: string[] }}
 */
function buildResult(prefix, partial, insertTexts, displayTexts) {
  const display = displayTexts ?? insertTexts;
  if (insertTexts.length === 0) return { completed: null, suggestions: [] };
  if (insertTexts.length === 1) return { completed: prefix + insertTexts[0] + " ", suggestions: [] };
  const lcp = longestCommonPrefix(insertTexts);
  const completed = lcp.length > partial.length ? prefix + lcp : null;
  return { completed, suggestions: display };
}

// ── Completion providers ──────────────────────────────────────────────────────

/**
 * Simple list completion: case-insensitive prefix match, insert as-is.
 * @param {string[]} candidates
 * @param {string} partial
 * @returns {{ insertTexts: string[], displayTexts: string[] }}
 */
function fromList(candidates, partial) {
  const lc = partial.toLowerCase();
  const matches = candidates.filter(c => c.toLowerCase().startsWith(lc));
  return { insertTexts: matches, displayTexts: matches };
}

/**
 * Node completion: matches by id prefix or label prefix; always inserts id.
 * Hidden nodes are excluded.
 * @param {Object.<string, NodeState>} nodes
 * @param {string} partial
 * @returns {{ insertTexts: string[], displayTexts: string[] }}
 */
function fromNodes(nodes, partial) {
  const lc = partial.toLowerCase();
  const matches = Object.values(nodes).filter(n =>
    n.visibility !== "hidden" &&
    (n.id.toLowerCase().startsWith(lc) || n.label.toLowerCase().startsWith(lc))
  );
  const ids = matches.map(n => n.id);
  return { insertTexts: ids, displayTexts: ids };
}

/**
 * Card completion: matches by id prefix or name prefix; inserts id when matched
 * by id, name when matched by name.  Disclosed cards are excluded.
 * Suggestions show "id  name" for readability.
 * @param {ExploitCard[]} hand
 * @param {string} partial
 * @returns {{ insertTexts: string[], displayTexts: string[] }}
 */
function fromCards(hand, partial) {
  const lc = partial.toLowerCase();
  const matches = hand.filter(c =>
    c.decayState !== "disclosed" &&
    (c.id.toLowerCase().startsWith(lc) || c.name.toLowerCase().startsWith(lc))
  );
  const insertTexts = matches.map(c =>
    c.id.toLowerCase().startsWith(lc) ? c.id : c.name
  );
  return { insertTexts, displayTexts: matches.map(c => `${c.id}  ${c.name}`) };
}

/**
 * Vuln-id completion: inserts id, shows "id  name" in suggestions.
 * @param {string} partial
 * @returns {{ insertTexts: string[], displayTexts: string[] }}
 */
function fromVulnIds(partial) {
  const lc = partial.toLowerCase();
  const matches = VULNERABILITY_TYPES.filter(v => v.id.toLowerCase().startsWith(lc));
  return {
    insertTexts: matches.map(v => v.id),
    displayTexts: matches.map(v => `${v.id}  ${v.name}`),
  };
}

/** Complete a single optional node argument.  Used by several commands. */
function completeNodeArg(args, partial, state) {
  return args.length === 0 ? fromNodes(state.nodes, partial) : null;
}

// ── Execute helpers ───────────────────────────────────────────────────────────

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
  if (matches.length > 1) {
    addLogEntry(`Ambiguous node: ${matches.map((n) => n.id).join(", ")}`, "error");
    return null;
  }

  addLogEntry(`Unknown node: ${token}`, "error");
  return null;
}

function resolveImplicitNode() {
  const s = getState();
  const nodeId = s.selectedNodeId;
  if (!nodeId || !s.nodes[nodeId]) {
    addLogEntry("No node selected. Use: select <node>", "error");
    return null;
  }
  return s.nodes[nodeId];
}

// Mirrors the sort order used by the hand pane when a node is selected.
function resolveCard(token) {
  const s = getState();
  if (!token) return null;
  const lower = token.toLowerCase();

  const num = parseInt(token, 10);
  if (!isNaN(num) && num >= 1 && num <= s.player.hand.length) {
    const selectedNode = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
    const hand = selectedNode
      ? [...s.player.hand].sort((a, b) => exploitSortKey(a, selectedNode) - exploitSortKey(b, selectedNode))
      : s.player.hand;
    return hand[num - 1] || null;
  }

  const byId = s.player.hand.find((c) => c.id === token);
  if (byId) return byId;

  const matches = s.player.hand.filter(
    (c) => c.decayState !== "disclosed" &&
      (c.name.toLowerCase().startsWith(lower) || c.id.toLowerCase().startsWith(lower))
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    addLogEntry(`Ambiguous card: ${matches.map((c) => c.id).join(", ")}`, "error");
    return null;
  }

  addLogEntry(`Unknown card: ${token}`, "error");
  return null;
}

function dispatch(actionId, detail = {}) {
  emitEvent("starnet:action", { actionId, ...detail, fromConsole: true });
}

function resolveWanAccess() {
  const s = getState();
  if (s.phase !== "playing") { addLogEntry("Not connected to network.", "error"); return false; }
  if (s.nodes[s.selectedNodeId]?.type !== "wan") {
    addLogEntry("Access denied. Select WAN node first.", "error");
    return false;
  }
  return true;
}

// ── status sub-commands ───────────────────────────────────────────────────────

function cmdStatusSummary() {
  const s = getState();
  const timers = getVisibleTimers();
  const lines = ["SUMMARY", "───────"];

  const traceStr = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "—";
  lines.push(`  Seed: "${s.seed}"  |  Alert: ${s.globalAlert.toUpperCase()}  |  Cash: ¥${s.player.cash.toLocaleString()}  |  Trace: ${traceStr}`);

  let iceStr;
  if (!s.ice) iceStr = "NONE";
  else if (!s.ice.active) iceStr = "INACTIVE";
  else if (isIceVisible(s.ice, s.nodes, s.selectedNodeId))
    iceStr = `ACTIVE @ ${s.nodes[s.ice.residentNodeId]?.label ?? s.ice.residentNodeId} → ${s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId}`;
  else iceStr = "ACTIVE (location unknown)";
  const detectTimer = timers.find((t) => t.label === "ICE DETECTION");
  const detectStr = detectTimer ? `${detectTimer.remaining}s remaining` : "—";
  lines.push(`  ICE: ${iceStr}  |  Detection: ${detectStr}`);

  if (s.selectedNodeId) {
    const sel = s.nodes[s.selectedNodeId];
    lines.push(`  Selected: ${s.selectedNodeId} [${sel.type}] ${sel.accessLevel}  |  Node alert: ${sel.alertState.toUpperCase()}`);
  } else {
    lines.push(`  Selected: none`);
  }

  if (s.activeProbe) {
    const scanTimer = timers.find((t) => t.label === "SCANNING");
    const scanStr = scanTimer ? `${scanTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Scanning: ${s.nodes[s.activeProbe.nodeId]?.label ?? s.activeProbe.nodeId}  |  ${scanStr}`);
  }

  if (s.activeLoot) {
    const lootTimer = timers.find((t) => t.label === "EXTRACTING");
    const lootStr = lootTimer ? `${lootTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Extracting: ${s.nodes[s.activeLoot.nodeId]?.label ?? s.activeLoot.nodeId}  |  ${lootStr}`);
  }

  if (s.activeRead) {
    const readTimer = timers.find((t) => t.label === "READING");
    const readStr = readTimer ? `${readTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Reading: ${s.nodes[s.activeRead.nodeId]?.label ?? s.activeRead.nodeId}  |  ${readStr}`);
  }

  if (s.executingExploit) {
    const execCard = s.player.hand.find((c) => c.id === s.executingExploit.exploitId);
    const execTimer = timers.find((t) => t.label === "EXECUTING");
    const execStr = execTimer ? `${execTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Executing: ${execCard?.name ?? s.executingExploit.exploitId} @ ${s.executingExploit.nodeId}  |  ${execStr}`);
  }

  const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
  const matchCount = sel
    ? s.player.hand.filter((c) => exploitSortKey(c, sel) === 0).length
    : 0;
  const handStr = sel
    ? `${s.player.hand.length} cards  (${matchCount} match selected node)`
    : `${s.player.hand.length} cards`;
  lines.push(`  Hand: ${handStr}`);

  const nodes = Object.values(s.nodes);
  const accessibleCount = nodes.filter((n) => n.visibility === "accessible").length;
  const ownedCount = nodes.filter((n) => n.accessLevel === "owned").length;
  const lootableCount = nodes.filter(
    (n) => n.accessLevel === "owned" && n.read && n.macguffins.some((m) => !m.collected)
  ).length;
  lines.push(`  Network: ${accessibleCount} accessible  |  ${ownedCount} owned  |  ${lootableCount} lootable`);

  if (s.mission) {
    const collectedStr = s.mission.complete ? "COLLECTED" : "not yet collected";
    lines.push(`  Mission: retrieve ${s.mission.targetName}  — ${collectedStr}`);
  } else {
    lines.push(`  Mission: none`);
  }

  lines.forEach((line) => addLogEntry(line, "meta"));
}

function cmdStatusFull() {
  const s = getState();
  const timers = getVisibleTimers();
  const lines = [];

  const worn = s.player.hand.filter((c) => c.decayState === "worn").length;
  const disclosed = s.player.hand.filter((c) => c.decayState === "disclosed").length;
  const handDesc = `hand: ${s.player.hand.length} exploits`
    + (worn      ? `, ${worn} worn`      : "")
    + (disclosed ? `, ${disclosed} disclosed` : "");
  lines.push(`## STATUS`);
  lines.push(`### PLAYER`);
  lines.push(`- seed: "${s.seed}"`);
  lines.push(`- cash: ¥${s.player.cash.toLocaleString()}`);
  lines.push(`- ${handDesc}`);

  lines.push(`### ALERT`);
  const traceStr = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "--";
  lines.push(`- global: ${s.globalAlert.toUpperCase()}  trace: ${traceStr}`);
  if (timers.length > 0) {
    timers.forEach((t) => lines.push(`- ⚠ ${t.label}: ${t.remaining}s`));
  }

  lines.push(`### ICE`);
  if (s.ice?.active) {
    lines.push(`- status: ACTIVE  grade: ${s.ice.grade}`);
    if (isIceVisible(s.ice, s.nodes, s.selectedNodeId)) {
      const pos      = s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId;
      const resident = s.nodes[s.ice.residentNodeId]?.label  ?? s.ice.residentNodeId;
      lines.push(`- attention: ${pos}  resident: ${resident}`);
    } else {
      lines.push(`- attention: unknown`);
    }
  } else {
    lines.push(`- status: ${s.ice ? "INACTIVE" : "NONE"}`);
  }

  lines.push(`### SELECTED`);
  if (s.selectedNodeId) {
    const sel = s.nodes[s.selectedNodeId];
    lines.push(`- ${s.selectedNodeId}  [${sel.type}]  access: ${sel.accessLevel}  alert: ${sel.alertState}`);
  } else {
    lines.push(`- none`);
  }

  lines.push(`### NETWORK`);
  const accessible = Object.values(s.nodes).filter((n) => n.visibility === "accessible");
  const revealed = Object.values(s.nodes).filter((n) => n.visibility === "revealed");

  accessible.forEach((node) => {
    const selected = node.id === s.selectedNodeId ? "  [SELECTED]" : "";
    const probed   = node.probed ? "  probed" : "";
    lines.push(`- ${node.id}  [${node.type}]  ${node.accessLevel}  alert:${node.alertState}${probed}${selected}`);
    if (node.probed && node.vulnerabilities.length > 0) {
      const vulns = node.vulnerabilities
        .filter((v) => !v.hidden)
        .map((v) => `${v.id}${v.patched ? "(patched)" : ""}`)
        .join(", ");
      if (vulns) lines.push(`  vulns: ${vulns}`);
    }
  });

  revealed.forEach((node) => {
    lines.push(`- ${node.id}  [${node.type}]  revealed`);
  });

  lines.push(`### HAND`);
  if (s.player.hand.length === 0) {
    lines.push(`- (empty)`);
  } else {
    s.player.hand.forEach((card, i) => {
      const decay   = card.decayState !== "fresh" ? `  [${card.decayState.toUpperCase()}]` : "";
      const targets = card.targetVulnTypes.join(", ");
      lines.push(`- [${i + 1}] ${card.name}  ${card.rarity}  uses:${card.usesRemaining}  targets:${targets}${decay}`);
    });
  }

  lines.forEach((line) => addLogEntry(line, "meta"));
}

function cmdStatusIce() {
  const s = getState();
  const timers = getVisibleTimers();
  const lines = ["## STATUS: ICE"];
  if (s.ice?.active) {
    lines.push(`- status: ACTIVE  grade: ${s.ice.grade}`);
    if (isIceVisible(s.ice, s.nodes, s.selectedNodeId)) {
      const pos      = s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId;
      const resident = s.nodes[s.ice.residentNodeId]?.label  ?? s.ice.residentNodeId;
      lines.push(`- attention: ${pos}  resident: ${resident}`);
    } else {
      lines.push(`- attention: unknown`);
    }
    const detectTimer = timers.find((t) => t.label === "ICE DETECTION");
    if (detectTimer) lines.push(`- ⚠ detection in: ${detectTimer.remaining}s`);
  } else {
    lines.push(`- status: ${s.ice ? "INACTIVE" : "NONE"}`);
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

function cmdStatusHand() {
  const s = getState();
  const selectedNode = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
  const hand = selectedNode
    ? [...s.player.hand].sort((a, b) => exploitSortKey(a, selectedNode) - exploitSortKey(b, selectedNode))
    : s.player.hand;
  const lines = ["## STATUS: HAND"];
  if (hand.length === 0) {
    lines.push("- (empty)");
  } else {
    hand.forEach((card, i) => {
      const decay   = card.decayState !== "fresh" ? `  [${card.decayState.toUpperCase()}]` : "";
      const targets = card.targetVulnTypes.join(", ");
      lines.push(`- [${i + 1}] ${card.name}  ${card.rarity}  uses:${card.usesRemaining}  targets:${targets}${decay}`);
    });
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

function cmdStatusNode(args) {
  const s = getState();
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  const lines = [`## STATUS: NODE ${node.id}`];
  lines.push(`- label: ${node.label}  type: ${node.type}  grade: ${node.grade ?? "N/A"}`);
  lines.push(`- access: ${node.accessLevel}  alert: ${node.alertState}`);
  lines.push(`- visibility: ${node.visibility}  probed: ${node.probed}  read: ${node.read}  looted: ${node.looted}`);
  if (node.rebooting) lines.push(`- REBOOTING`);
  if (node.eventForwardingDisabled !== undefined) {
    lines.push(`- event forwarding: ${node.eventForwardingDisabled ? "disabled" : "enabled"}`);
  }
  if (node.probed && node.vulnerabilities.length > 0) {
    const vulns = node.vulnerabilities
      .filter((v) => !v.hidden)
      .map((v) => `${v.id}${v.patched ? "(patched)" : ""}`)
      .join(", ");
    if (vulns) lines.push(`- vulns: ${vulns}`);
  }
  if (node.read && node.macguffins.length > 0) {
    node.macguffins.forEach((m) => {
      const isMission = s.mission?.targetMacguffinId === m.id ? " [MISSION]" : "";
      lines.push(`- item: ${m.name}  ¥${m.cashValue.toLocaleString()}${isMission}  collected:${m.collected}`);
    });
  }
  if (s.ice?.active && s.ice.attentionNodeId === node.id && isIceVisible(s.ice, s.nodes, s.selectedNodeId)) {
    lines.push(`- ⚠ ICE present (grade: ${s.ice.grade})`);
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

function cmdStatusAlert() {
  const s = getState();
  const timers = getVisibleTimers();
  const lines = ["## STATUS: ALERT"];
  const traceStr = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "--";
  lines.push(`- global: ${s.globalAlert.toUpperCase()}  trace: ${traceStr}`);
  timers.forEach((t) => lines.push(`- ⚠ ${t.label}: ${t.remaining}s`));
  const secNodes = Object.values(s.nodes).filter(
    (n) => n.visibility !== "hidden" && (n.type === "ids" || n.type === "security-monitor")
  );
  if (secNodes.length > 0) {
    lines.push("- security nodes:");
    secNodes.forEach((n) => {
      const fwd = n.type === "ids"
        ? (n.eventForwardingDisabled ? "  [fwd:OFF]" : "  [fwd:ON]")
        : "";
      lines.push(`  ${n.id}  [${n.type}]  alert:${n.alertState}${fwd}`);
    });
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

function cmdStatusMission() {
  const s = getState();
  const lines = ["## STATUS: MISSION"];
  if (!s.mission) {
    lines.push("- no active mission");
  } else {
    lines.push(`- target: ${s.mission.targetName}`);
    lines.push(`- complete: ${s.mission.complete ? "YES" : "NO"}`);
    let found = null;
    for (const node of Object.values(s.nodes)) {
      const m = node.macguffins?.find((m) => m.id === s.mission.targetMacguffinId);
      if (m) { found = { ...m, nodeId: node.id, nodeLabel: node.label }; break; }
    }
    if (found) {
      lines.push(`- value: ¥${found.cashValue.toLocaleString()}`);
      lines.push(`- location: ${found.nodeLabel} (${found.nodeId})`);
      lines.push(`- collected: ${found.collected ? "YES" : "NO"}`);
    }
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

// ── Shared constants for completion ──────────────────────────────────────────

const STATUS_NOUNS     = ["summary", "ice", "hand", "node", "alert", "mission"];
const CHEAT_SUBS       = ["give", "set", "own", "own-all", "trace", "summon-ice", "teleport-ice", "ice-state", "snapshot", "relayout", "restore", "help"];
const CHEAT_GIVE_SUBS  = ["matching", "card", "cash"];
const CHEAT_RARITIES   = ["common", "uncommon", "rare"];
const CHEAT_ALERTS     = ["green", "yellow", "red", "trace"];
const CHEAT_TRACE_SUBS = ["start", "end"];

// ── Command definitions ───────────────────────────────────────────────────────

/** @type {CommandDef[]} */
const COMMANDS = [

  // ── Node-arg commands ──────────────────────────────────────────────────────

  { verb: "select",
    complete: completeNodeArg,
    execute(args) {
      if (args.length < 1) { addLogEntry("Usage: select <node>", "error"); return; }
      const node = resolveNode(args[0]);
      if (!node) return;
      dispatch("select", { nodeId: node.id });
    },
  },

  { verb: "deselect",
    execute() { dispatch("deselect"); },
  },

  { verb: "probe",
    complete: completeNodeArg,
    execute(args) {
      const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
      if (!node) return;
      dispatch("probe", { nodeId: node.id });
    },
  },

  { verb: "read",
    complete: completeNodeArg,
    execute(args) {
      const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
      if (!node) return;
      dispatch("read", { nodeId: node.id });
    },
  },

  { verb: "loot",
    complete: completeNodeArg,
    execute(args) {
      const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
      if (!node) return;
      dispatch("loot", { nodeId: node.id });
    },
  },

  { verb: "reconfigure",
    complete: completeNodeArg,
    execute(args) {
      const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
      if (!node) return;
      dispatch("reconfigure", { nodeId: node.id });
    },
  },

  { verb: "reboot",
    complete: completeNodeArg,
    execute(args) {
      const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
      if (!node) return;
      if (node.accessLevel !== "owned") {
        addLogEntry(`${node.label}: must be owned to reboot.`, "error");
        return;
      }
      dispatch("reboot", { nodeId: node.id });
    },
  },

  // ── Cancel commands ────────────────────────────────────────────────────────

  { verb: "cancel-probe",
    execute() {
      if (!getState().activeProbe) { addLogEntry("No probe scan in progress.", "error"); return; }
      dispatch("cancel-probe");
    },
  },

  { verb: "cancel-exploit",
    execute() {
      if (!getState().executingExploit) { addLogEntry("No exploit execution in progress.", "error"); return; }
      dispatch("cancel-exploit");
    },
  },

  { verb: "cancel-read",
    execute() {
      if (!getState().activeRead) { addLogEntry("No read scan in progress.", "error"); return; }
      dispatch("cancel-read");
    },
  },

  { verb: "cancel-loot",
    execute() {
      if (!getState().activeLoot) { addLogEntry("No loot extraction in progress.", "error"); return; }
      dispatch("cancel-loot");
    },
  },

  { verb: "cancel-trace",
    execute() {
      const s = getState();
      const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
      if (!sel) { addLogEntry("No node selected.", "error"); return; }
      const available = getActions(sel, s).find((a) => a.id === "cancel-trace");
      if (!available) { addLogEntry(`${sel.label}: cancel-trace not available.`, "error"); return; }
      dispatch("cancel-trace", { nodeId: sel.id });
    },
  },

  // ── exploit ────────────────────────────────────────────────────────────────

  { verb: "exploit",
    complete(args, partial, state) {
      if (args.length === 0 && state.selectedNodeId) return fromCards(state.player.hand, partial);
      if (args.length === 0) return fromNodes(state.nodes, partial);
      if (args.length === 1) return fromCards(state.player.hand, partial);
      return null;
    },
    execute(args) {
      const s = getState();
      if (args.length >= 2) {
        const node = resolveNode(args[0]);
        if (!node) return;
        const card = resolveCard(args.slice(1).join(" "));
        if (!card) return;
        dispatch("exploit", { nodeId: node.id, exploitId: card.id });
      } else if (args.length === 1 && s.selectedNodeId) {
        const node = resolveImplicitNode();
        if (!node) return;
        const card = resolveCard(args[0]);
        if (!card) return;
        dispatch("exploit", { nodeId: node.id, exploitId: card.id });
      } else {
        addLogEntry("Usage: exploit <node> <card>  (or select a node first: exploit <card>)", "error");
      }
    },
  },

  // ── eject ──────────────────────────────────────────────────────────────────

  { verb: "eject",
    execute() {
      const s = getState();
      if (!s.ice?.active || s.ice.attentionNodeId !== s.selectedNodeId) {
        addLogEntry("No ICE present at selected node.", "error");
        return;
      }
      dispatch("eject", { nodeId: s.selectedNodeId });
    },
  },

  // ── jackout ────────────────────────────────────────────────────────────────

  { verb: "jackout",
    execute() { dispatch("jackout"); },
  },

  // ── actions ────────────────────────────────────────────────────────────────

  { verb: "actions",
    execute() {
      const s = getState();
      const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
      const actions = getAvailableActions(sel, s);
      const has = new Set(actions.map((a) => a.id));
      const lines = ["AVAILABLE ACTIONS", "─────────────────"];

      if (has.has("jackout")) {
        lines.push("  jackout                  — disconnect and end run");
      }

      if (has.has("select")) {
        const accessible = Object.values(s.nodes)
          .filter((n) => n.visibility === "accessible" && !n.rebooting && n.id !== s.selectedNodeId);
        const revealed = Object.values(s.nodes)
          .filter((n) => n.visibility === "revealed" && n.id !== s.selectedNodeId);
        const parts = [];
        if (accessible.length > 0) parts.push(`accessible: ${accessible.map((n) => n.id).join(", ")}`);
        if (revealed.length > 0) parts.push(`traverse: ${revealed.map((n) => n.id).join(", ")}`);
        lines.push(`  select <nodeId>          — ${parts.join("  |  ")}`);
      }

      if (sel) {
        if (has.has("deselect")) lines.push("  deselect                 — clear selection");

        if (has.has("cancel-probe")) {
          lines.push(`  cancel-probe             — abort vulnerability scan`);
        } else if (has.has("probe")) {
          lines.push(`  probe                    — scan ${sel.id} for vulnerabilities`);
        }

        if (has.has("cancel-exploit")) {
          const execCard = s.player.hand.find((c) => c.id === s.executingExploit?.exploitId);
          lines.push(`  cancel-exploit           — abort ${execCard?.name ?? "exploit"} execution`);
        } else if (has.has("exploit")) {
          const sorted = [...s.player.hand].sort(
            (a, b) => exploitSortKey(a, sel) - exploitSortKey(b, sel)
          );
          if (sorted.length > 0) {
            lines.push(`  exploit <n>              — attack ${sel.id} (${sel.accessLevel}):`);
            sorted.forEach((card, i) => {
              const knownVulnIds = sel.probed
                ? sel.vulnerabilities.filter((v) => !v.patched && !v.hidden).map((v) => v.id)
                : [];
              const matches = card.targetVulnTypes.some((t) => knownVulnIds.includes(t));
              const worn = card.usesRemaining <= 0 ? "  [WORN]" : "";
              const disclosed = card.decayState === "disclosed" ? "  [DISCLOSED]" : "";
              const matchStr = sel.probed ? (matches ? "  ✓ match" : "  no match") : "";
              lines.push(`    ${i + 1}. ${card.name} [${card.rarity}]  targets: ${card.targetVulnTypes.join(", ")}${matchStr}${worn}${disclosed}`);
            });
          }
        }

        if (has.has("cancel-read")) {
          lines.push(`  cancel-read              — abort data extraction`);
        } else if (has.has("read")) {
          lines.push(`  read                     — scan ${sel.id} contents`);
        }
        if (has.has("cancel-loot")) {
          lines.push(`  cancel-loot              — abort extraction`);
        } else if (has.has("loot")) {
          lines.push(`  loot                     — extract items from ${sel.id}`);
        }
        if (has.has("eject"))  lines.push(`  eject                    — push ICE to adjacent node`);
        if (has.has("reboot")) lines.push(`  reboot                   — send ICE home, take ${sel.id} offline briefly`);

        getActions(sel, s).forEach((a) => {
          lines.push(`  ${a.id.padEnd(24)} — ${a.desc(sel, s)}`);
        });

        if (sel.type === "wan") {
          lines.push(`  store                    — list darknet broker catalog`);
          lines.push(`  buy <index>              — purchase exploit card from broker`);
        }

        if (sel.probed) {
          lines.push(`  cheat give matching      — add matching exploits [balance rescue — sets cheat flag]`);
        }
      }

      const traceActive = s.traceSecondsRemaining !== null;
      lines.push(traceActive
        ? `  cheat trace end          — cancel active trace countdown [${s.traceSecondsRemaining}s remaining]`
        : `  cheat trace start        — start 60s trace countdown`
      );

      lines.forEach((line) => addLogEntry(line, "meta"));
    },
  },

  // ── status ─────────────────────────────────────────────────────────────────

  { verb: "status",
    complete(args, partial, state) {
      if (args.length === 0) return fromList(STATUS_NOUNS, partial);
      if (args[0] === "node" && args.length === 1) return fromNodes(state.nodes, partial);
      return null;
    },
    execute(args) {
      const noun = args[0]?.toLowerCase();
      if (!noun) return cmdStatusFull();
      switch (noun) {
        case "full":    return cmdStatusFull();
        case "summary": return cmdStatusSummary();
        case "ice":     return cmdStatusIce();
        case "hand":    return cmdStatusHand();
        case "node":    return cmdStatusNode(args.slice(1));
        case "alert":   return cmdStatusAlert();
        case "mission": return cmdStatusMission();
        default:
          addLogEntry(`Unknown status noun: ${noun}. Try: full summary ice hand node alert mission`, "error");
      }
    },
  },

  // ── store / buy ────────────────────────────────────────────────────────────

  { verb: "store",
    execute() {
      if (!resolveWanAccess()) return;
      const s = getState();
      const catalog = getStoreCatalog();
      const lines = ["DARKNET BROKER", "──────────────────────────────────────────", `Wallet: ¥${s.player.cash.toLocaleString()}`];
      catalog.forEach((item, i) => {
        const canAfford = s.player.cash >= item.price ? "" : "  [INSUFFICIENT FUNDS]";
        lines.push(`  [${i + 1}] ${item.name}  [${item.rarity}]  ${item.vulnId}  ¥${item.price}${canAfford}`);
      });
      lines.push("Use: buy <index>  to purchase");
      lines.forEach((l) => addLogEntry(l, "meta"));
    },
  },

  { verb: "buy",
    complete(args, partial) {
      return args.length === 0 ? fromVulnIds(partial) : null;
    },
    execute(args) {
      if (!resolveWanAccess()) return;
      if (!args[0]) { addLogEntry("Usage: buy <index>", "error"); return; }
      const num = parseInt(args[0], 10);
      const key = !isNaN(num) ? num : args[0];
      const result = buyFromStore(key);
      if (!result) {
        const s = getState();
        const catalog = getStoreCatalog();
        const item = !isNaN(num)
          ? catalog[num - 1]
          : catalog.find((c) => c.vulnId.toLowerCase().startsWith(args[0].toLowerCase()));
        if (item && s.player.cash < item.price) {
          addLogEntry(`Insufficient funds. Need ¥${item.price}, have ¥${s.player.cash.toLocaleString()}.`, "error");
        } else {
          addLogEntry(`Unknown item: ${args[0]}`, "error");
        }
        return;
      }
      addLogEntry(`Purchased: ${result.card.name}  [${result.card.rarity}]  targets:${result.vulnId}  cost:¥${result.price}`, "success");
    },
  },

  // ── log / help ─────────────────────────────────────────────────────────────

  { verb: "log",
    execute(args) {
      const n = Math.min(Math.max(parseInt(args[0], 10) || 20, 1), 200);
      const entries = getRecentLog(n);
      addLogEntry(`-- LOG REPLAY (last ${entries.length}) --`, "meta");
      entries.forEach(({ text, type }) => addLogEntry(text, type));
    },
  },

  { verb: "help",
    execute() {
      const lines = [
        "[SYS] Available commands:",
        "  select <node>             Set active node (by id or label prefix)",
        "  deselect                  Clear node selection",
        "  probe [node]              Reveal vulnerabilities. Raises local alert.",
        "  exploit [node] <card>     Launch exploit. Card by index, id, or name prefix.",
        "  read [node]               Scan node contents.",
        "  loot [node]               Collect macguffins from owned node.",
        "  reconfigure [node]        Disable IDS event forwarding.",
        "  cancel-probe              Abort an in-progress probe scan.",
        "  cancel-read               Abort an in-progress data extraction.",
        "  cancel-loot               Abort an in-progress loot extraction.",
        "  cancel-exploit            Abort an in-progress exploit execution (no card decay).",
        "  cancel-trace              Abort trace countdown (requires owned security-monitor selected).",
        "  eject                     Push ICE attention to adjacent node.",
        "  reboot [node]             Send ICE home. Node offline briefly.",
        "  jackout                   Disconnect and end run.",
        "  actions                   List all currently valid actions with context.",
        "  status [noun]             Game state. Nouns: summary ice hand node alert mission",
        "  store                     List darknet broker catalog (requires WAN selected).",
        "  buy <index>               Purchase exploit card from broker (requires WAN selected).",
        "  log [n]                   Replay last n log entries (default: 20).",
        "  help                      Show this listing.",
        "  // CHEAT — playtesting only. Cheaters never win.",
        "  cheat give matching [node]  Add exploits matching node's vulns (balance rescue).",
        "  cheat give card [rarity]    Add random exploit card.",
        "  cheat give cash <amount>    Add credits to wallet.",
        "  cheat set alert <level>     Force alert level: green yellow red trace",
        "  cheat own <node>            Set node to owned + reveal neighbors.",
        "  cheat trace start           Start 60s trace countdown immediately.",
        "  cheat trace end             Cancel active trace countdown.",
      ];
      lines.forEach((line) => addLogEntry(line, "meta"));
    },
  },

  // ── cheat (headless) ───────────────────────────────────────────────────────
  // Handles all sub-commands that don't require browser APIs.
  // console.js overrides this entry to add relayout and restore, then delegates
  // here for everything else.

  { verb: "cheat",
    complete(args, partial, state) {
      if (args.length === 0) return fromList(CHEAT_SUBS, partial);

      const [sub, ...subArgs] = args;

      if (sub === "give") {
        if (subArgs.length === 0) return fromList(CHEAT_GIVE_SUBS, partial);
        if (subArgs[0] === "matching" && subArgs.length === 1) return fromNodes(state.nodes, partial);
        if (subArgs[0] === "card"     && subArgs.length === 1) return fromList(CHEAT_RARITIES, partial);
        return null;
      }

      if (sub === "set") {
        if (subArgs.length === 0) return fromList(["alert"], partial);
        if (subArgs[0] === "alert" && subArgs.length === 1) return fromList(CHEAT_ALERTS, partial);
        return null;
      }

      if (sub === "own"         && subArgs.length === 0) return fromNodes(state.nodes, partial);
      if (sub === "trace"       && subArgs.length === 0) return fromList(CHEAT_TRACE_SUBS, partial);
      if ((sub === "summon-ice" || sub === "teleport-ice") && subArgs.length === 0) {
        return fromNodes(state.nodes, partial);
      }

      return null;
    },
    execute(args) {
      // relayout and restore are browser-only — handled by the override in console.js.
      // If somehow reached in a headless context they fall through to cheats.js which
      // will log "Unknown cheat: ..." — acceptable.
      import("./cheats.js").then(({ handleCheatCommand }) => {
        const sub = args[0]?.toLowerCase();
        if (sub === "snapshot") {
          // snapshot requires a saveGame callback; not available in headless
          handleCheatCommand(args, { saveGame: null });
        } else {
          handleCheatCommand(args);
        }
      });
    },
  },

];

// Register all core commands.
COMMANDS.forEach(registerCommand);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * All recognized console verbs, derived from the registry.
 * Snapshot taken after core registration; tabComplete() reads the live registry
 * so browser overrides (which replace existing verbs, not add new ones) are
 * reflected without changing this list.
 * @type {string[]}
 */
export const VERBS = [...registry.keys()];

/**
 * Pure tab completion.  No DOM, no I/O.
 *
 * @param {string} rawInput  - current value of the console input field
 * @param {GameState} state  - current game state (read-only)
 * @returns {{ completed: string|null, suggestions: string[] }}
 */
export function tabComplete(rawInput, state) {
  const tokens = rawInput.split(/\s+/);
  const partial = tokens[tokens.length - 1];
  const committed = tokens.slice(0, -1).map(t => t.toLowerCase());
  const prefix = committed.length > 0 ? committed.join(" ") + " " : "";

  // No committed verb yet — complete the verb itself from the live registry.
  if (committed.length === 0) {
    const { insertTexts, displayTexts } = fromList([...registry.keys()], partial);
    return buildResult("", partial, insertTexts, displayTexts);
  }

  const cmd = registry.get(committed[0]);
  if (!cmd?.complete) return { completed: null, suggestions: [] };

  const args = committed.slice(1);
  const provider = cmd.complete(args, partial, state);
  if (!provider) return { completed: null, suggestions: [] };

  const { insertTexts, displayTexts } = provider;
  return buildResult(prefix, partial, insertTexts, displayTexts);
}
