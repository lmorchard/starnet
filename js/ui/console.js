// @ts-check
// Console — keyboard command input for the log pane
// Handles input, history, tab completion, and command dispatch.

/** @typedef {import('../core/types.js').GameState} GameState */
/** @typedef {import('../core/types.js').NodeState} NodeState */
/** @typedef {import('../core/types.js').ExploitCard} ExploitCard */

import { getState, isIceVisible } from "../core/state.js";
import { addLogEntry, getRecentLog } from "../core/log.js";
import { emitEvent, on, E } from "../core/events.js";
import { getVisibleTimers } from "../core/timers.js";
import { exploitSortKey, getStoreCatalog } from "../core/exploits.js";
import { getActions } from "../core/actions/node-types.js";
import { getAvailableActions } from "../core/actions/node-actions.js";
import { buyFromStore } from "../core/store-logic.js";

const VERBS = ["select", "deselect", "probe", "exploit", "eject", "reboot", "read", "loot", "reconfigure", "cancel-probe", "cancel-exploit", "cancel-read", "cancel-loot", "cancel-trace", "jackout", "status", "actions", "store", "buy", "log", "help", "cheat"];
const STATUS_NOUNS = ["summary", "ice", "hand", "node", "alert", "mission"];

let history = [];
let historyIndex = -1;

export function pushHistory(cmd) {
  if (!cmd) return;
  history.unshift(cmd);
  if (history.length > 50) history.length = 50;
}

export function initConsole() {
  const input = /** @type {HTMLInputElement|null} */ (document.getElementById("console-input"));
  if (!input) return;

  on(E.COMMAND_ISSUED, ({ cmd }) => pushHistory(cmd));

  input.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") {
      const raw = input.value.trim();
      input.value = "";
      historyIndex = -1;
      if (!raw) return;
      submitCommand(raw);

    } else if (evt.key === "ArrowUp") {
      evt.preventDefault();
      if (historyIndex < history.length - 1) {
        historyIndex++;
        input.value = history[historyIndex];
      }

    } else if (evt.key === "ArrowDown") {
      evt.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = history[historyIndex];
      } else {
        historyIndex = -1;
        input.value = "";
      }

    } else if (evt.key === "Tab") {
      evt.preventDefault();
      handleTabComplete(input);
    }
  });
}

// Public API for programmatic command dispatch (LLM playtesting, etc.)
export function runCommand(raw) {
  submitCommand(raw);
}

// ── Command dispatch ──────────────────────────────────────

function submitCommand(raw) {
  emitEvent(E.COMMAND_ISSUED, { cmd: raw });
  const tokens = raw.trim().split(/\s+/);
  const verb = tokens[0].toLowerCase();
  const args = tokens.slice(1);
  handleCommand(verb, args);
}

function handleCommand(verb, args) {
  switch (verb) {
    case "select":       return cmdSelect(args);
    case "deselect":     return cmdDeselect();
    case "probe":        return cmdProbe(args);
    case "exploit":      return cmdExploit(args);
    case "eject":        return cmdEject();
    case "reboot":       return cmdReboot(args);
    case "read":         return cmdRead(args);
    case "loot":         return cmdLoot(args);
    case "reconfigure":  return cmdReconfigure(args);
    case "cancel-probe":   return cmdCancelProbe();
    case "cancel-exploit": return cmdCancelExploit();
    case "cancel-read":    return cmdCancelRead();
    case "cancel-loot":    return cmdCancelLoot();
    case "cancel-trace": return cmdCancelTrace();
    case "jackout":      return cmdJackout();
    case "actions":      return cmdActions();
    case "status":       return cmdStatus(args);
    case "store":        return cmdStore();
    case "buy":          return cmdBuy(args);
    case "log":          return cmdLog(args);
    case "help":         return cmdHelp();
    case "cheat":        return cmdCheat(args);
    default:
      addLogEntry(`Unknown command: ${verb}`, "error");
  }
}

// ── Helpers ───────────────────────────────────────────────

function resolveNode(token) {
  const s = getState();
  if (!token) return null;
  const lower = token.toLowerCase();

  // Exact id match
  const byId = s.nodes[token];
  if (byId && byId.visibility !== "hidden") return byId;

  // Prefix match on label
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

// Returns the currently selected node, or logs an error if none is selected.
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

  // Numeric index (1-based) — matches the displayed sort order
  const num = parseInt(token, 10);
  if (!isNaN(num) && num >= 1 && num <= s.player.hand.length) {
    const selectedNode = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
    const hand = selectedNode
      ? [...s.player.hand].sort((a, b) => exploitSortKey(a, selectedNode) - exploitSortKey(b, selectedNode))
      : s.player.hand;
    return hand[num - 1] || null;
  }

  // Exact id match
  const byId = s.player.hand.find((c) => c.id === token);
  if (byId) return byId;

  // Prefix match on name
  const matches = s.player.hand.filter(
    (c) => c.decayState !== "disclosed" && c.name.toLowerCase().startsWith(lower)
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    addLogEntry(`Ambiguous card: ${matches.map((c) => c.name).join(", ")}`, "error");
    return null;
  }

  addLogEntry(`Unknown card: ${token}`, "error");
  return null;
}

function dispatch(actionId, detail = {}) {
  emitEvent("starnet:action", { actionId, ...detail, fromConsole: true });
}

// ── Command implementations ───────────────────────────────

function cmdSelect(args) {
  if (args.length < 1) { addLogEntry("Usage: select <node>", "error"); return; }
  const node = resolveNode(args[0]);
  if (!node) return;
  dispatch("select", { nodeId: node.id });
}

function cmdDeselect() {
  dispatch("deselect");
}

function cmdProbe(args) {
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  dispatch("probe", { nodeId: node.id });
}

function cmdExploit(args) {
  const s = getState();
  if (args.length >= 2) {
    // Explicit form: exploit <node> <card>
    const node = resolveNode(args[0]);
    if (!node) return;
    const card = resolveCard(args.slice(1).join(" "));
    if (!card) return;
    dispatch("exploit", { nodeId: node.id, exploitId: card.id });
  } else if (args.length === 1 && s.selectedNodeId) {
    // Implicit form: exploit <card>  (uses selected node)
    const node = resolveImplicitNode();
    if (!node) return;
    const card = resolveCard(args[0]);
    if (!card) return;
    dispatch("exploit", { nodeId: node.id, exploitId: card.id });
  } else {
    addLogEntry("Usage: exploit <node> <card>  (or select a node first: exploit <card>)", "error");
  }
}

function cmdRead(args) {
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  dispatch("read", { nodeId: node.id });
}

function cmdLoot(args) {
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  dispatch("loot", { nodeId: node.id });
}

function cmdReconfigure(args) {
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  dispatch("reconfigure", { nodeId: node.id });
}

function cmdEject() {
  const s = getState();
  if (!s.ice?.active || s.ice.attentionNodeId !== s.selectedNodeId) {
    addLogEntry("No ICE present at selected node.", "error");
    return;
  }
  dispatch("eject", { nodeId: s.selectedNodeId });
}

function cmdReboot(args) {
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  if (node.accessLevel !== "owned") {
    addLogEntry(`${node.label}: must be owned to reboot.`, "error");
    return;
  }
  dispatch("reboot", { nodeId: node.id });
}

function cmdActions() {
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

    // Type-specific actions (reconfigure, cancel-trace, access-darknet, etc.)
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
}

function cmdStatus(args) {
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
}

function cmdStatusSummary() {
  const s = getState();
  const timers = getVisibleTimers();
  const lines = ["SUMMARY", "───────"];

  // Alert + trace
  const traceStr = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "—";
  lines.push(`  Seed: "${s.seed}"  |  Alert: ${s.globalAlert.toUpperCase()}  |  Cash: ¥${s.player.cash.toLocaleString()}  |  Trace: ${traceStr}`);

  // ICE + detection timer
  let iceStr;
  if (!s.ice) iceStr = "NONE";
  else if (!s.ice.active) iceStr = "INACTIVE";
  else if (isIceVisible(s.ice, s.nodes, s.selectedNodeId))
    iceStr = `ACTIVE @ ${s.nodes[s.ice.residentNodeId]?.label ?? s.ice.residentNodeId} → ${s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId}`;
  else iceStr = "ACTIVE (location unknown)";
  const detectTimer = timers.find((t) => t.label === "ICE DETECTION");
  const detectStr = detectTimer ? `${detectTimer.remaining}s remaining` : "—";
  lines.push(`  ICE: ${iceStr}  |  Detection: ${detectStr}`);

  // Selected node
  if (s.selectedNodeId) {
    const sel = s.nodes[s.selectedNodeId];
    lines.push(`  Selected: ${s.selectedNodeId} [${sel.type}] ${sel.accessLevel}  |  Node alert: ${sel.alertState.toUpperCase()}`);
  } else {
    lines.push(`  Selected: none`);
  }

  // Active probe scan
  if (s.activeProbe) {
    const scanTimer = timers.find((t) => t.label === "SCANNING");
    const scanStr = scanTimer ? `${scanTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Scanning: ${s.nodes[s.activeProbe.nodeId]?.label ?? s.activeProbe.nodeId}  |  ${scanStr}`);
  }

  // Active loot extraction
  if (s.activeLoot) {
    const lootTimer = timers.find((t) => t.label === "EXTRACTING");
    const lootStr = lootTimer ? `${lootTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Extracting: ${s.nodes[s.activeLoot.nodeId]?.label ?? s.activeLoot.nodeId}  |  ${lootStr}`);
  }

  // Active read scan
  if (s.activeRead) {
    const readTimer = timers.find((t) => t.label === "READING");
    const readStr = readTimer ? `${readTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Reading: ${s.nodes[s.activeRead.nodeId]?.label ?? s.activeRead.nodeId}  |  ${readStr}`);
  }

  // Executing exploit
  if (s.executingExploit) {
    const execCard = s.player.hand.find((c) => c.id === s.executingExploit.exploitId);
    const execTimer = timers.find((t) => t.label === "EXECUTING");
    const execStr = execTimer ? `${execTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Executing: ${execCard?.name ?? s.executingExploit.exploitId} @ ${s.executingExploit.nodeId}  |  ${execStr}`);
  }

  // Hand
  const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
  const matchCount = sel
    ? s.player.hand.filter((c) => exploitSortKey(c, sel) === 0).length
    : 0;
  const handStr = sel
    ? `${s.player.hand.length} cards  (${matchCount} match selected node)`
    : `${s.player.hand.length} cards`;
  lines.push(`  Hand: ${handStr}`);

  // Network
  const nodes = Object.values(s.nodes);
  const accessibleCount = nodes.filter((n) => n.visibility === "accessible").length;
  const ownedCount = nodes.filter((n) => n.accessLevel === "owned").length;
  const lootableCount = nodes.filter(
    (n) => n.accessLevel === "owned" && n.read && n.macguffins.some((m) => !m.collected)
  ).length;
  lines.push(`  Network: ${accessibleCount} accessible  |  ${ownedCount} owned  |  ${lootableCount} lootable`);

  // Mission
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

  // Player
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

  // Alert / timers
  lines.push(`### ALERT`);
  const traceStr = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "--";
  lines.push(`- global: ${s.globalAlert.toUpperCase()}  trace: ${traceStr}`);
  if (timers.length > 0) {
    timers.forEach((t) => lines.push(`- ⚠ ${t.label}: ${t.remaining}s`));
  }

  // ICE
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

  // Selected node
  lines.push(`### SELECTED`);
  if (s.selectedNodeId) {
    const sel = s.nodes[s.selectedNodeId];
    lines.push(`- ${s.selectedNodeId}  [${sel.type}]  access: ${sel.accessLevel}  alert: ${sel.alertState}`);
  } else {
    lines.push(`- none`);
  }

  // Network
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

  // Hand
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
    // Find the macguffin across all nodes to show value + location
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

function resolveWanAccess() {
  const s = getState();
  if (s.phase !== "playing") { addLogEntry("Not connected to network.", "error"); return false; }
  if (s.nodes[s.selectedNodeId]?.type !== "wan") {
    addLogEntry("Access denied. Select WAN node first.", "error");
    return false;
  }
  return true;
}

function cmdStore() {
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
}

function cmdBuy(args) {
  if (!resolveWanAccess()) return;
  if (!args[0]) { addLogEntry("Usage: buy <index>", "error"); return; }
  const num = parseInt(args[0], 10);
  const key = !isNaN(num) ? num : args[0];
  const result = buyFromStore(key);
  if (!result) {
    const s = getState();
    // Distinguish "not found" from "can't afford"
    const catalog = getStoreCatalog();
    const item = !isNaN(num) ? catalog[num - 1] : catalog.find((c) => c.vulnId.toLowerCase().startsWith(args[0].toLowerCase()));
    if (item && s.player.cash < item.price) {
      addLogEntry(`Insufficient funds. Need ¥${item.price}, have ¥${s.player.cash.toLocaleString()}.`, "error");
    } else {
      addLogEntry(`Unknown item: ${args[0]}`, "error");
    }
    return;
  }
  addLogEntry(`Purchased: ${result.card.name}  [${result.card.rarity}]  targets:${result.vulnId}  cost:¥${result.price}`, "success");
}

function cmdLog(args) {
  const n = Math.min(Math.max(parseInt(args[0], 10) || 20, 1), 200);
  const entries = getRecentLog(n);
  addLogEntry(`-- LOG REPLAY (last ${entries.length}) --`, "meta");
  entries.forEach(({ text, type }) => addLogEntry(text, type));
}

function cmdHelp() {
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
}

function cmdCancelProbe() {
  const s = getState();
  if (!s.activeProbe) {
    addLogEntry("No probe scan in progress.", "error");
    return;
  }
  dispatch("cancel-probe");
}

function cmdCancelRead() {
  const s = getState();
  if (!s.activeRead) {
    addLogEntry("No read scan in progress.", "error");
    return;
  }
  dispatch("cancel-read");
}

function cmdCancelLoot() {
  const s = getState();
  if (!s.activeLoot) {
    addLogEntry("No loot extraction in progress.", "error");
    return;
  }
  dispatch("cancel-loot");
}

function cmdCancelExploit() {
  const s = getState();
  if (!s.executingExploit) {
    addLogEntry("No exploit execution in progress.", "error");
    return;
  }
  dispatch("cancel-exploit");
}

function cmdCancelTrace() {
  const s = getState();
  const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
  if (!sel) { addLogEntry("No node selected.", "error"); return; }
  const available = getActions(sel, s).find((a) => a.id === "cancel-trace");
  if (!available) { addLogEntry(`${sel.label}: cancel-trace not available.`, "error"); return; }
  dispatch("cancel-trace", { nodeId: sel.id });
}

function cmdJackout() {
  dispatch("jackout");
}

function cmdCheat(args) {
  const sub = args[0]?.toLowerCase();

  // Browser-specific cheats handled here, not in core/cheats.js
  if (sub === "relayout") {
    const name = args[1]?.toLowerCase();
    import("./graph.js").then(({ relayout, getLayoutNames }) => {
      const used = relayout(name);
      if (name && used !== name) {
        addLogEntry(`[CHEAT] Unknown layout "${name}". Options: ${getLayoutNames().join(", ")}`, "error");
      } else {
        addLogEntry(`[CHEAT] Graph re-laid out (${used}).`, "success");
      }
    });
    return;
  }

  if (sub === "restore") {
    // Programmatic click — may not work in all browsers without a user gesture
    const input = /** @type {HTMLElement|null} */ (document.getElementById("load-file-input"));
    if (input) input.click();
    return;
  }

  // Everything else forwarded to cheats module — loaded lazily to keep cheat code isolated
  import("../core/cheats.js").then(({ handleCheatCommand }) => {
    if (sub === "snapshot") {
      import("./save-load.js").then(({ saveGame }) => {
        handleCheatCommand(args, { saveGame });
      });
    } else {
      handleCheatCommand(args);
    }
  });
}

// ── Tab completion ────────────────────────────────────────

function longestCommonPrefix(strings) {
  if (strings.length === 0) return "";
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) return "";
  }
  return prefix;
}

function handleTabComplete(input) {
  const value = input.value;
  const tokens = value.split(/\s+/);
  const s = getState();

  if (tokens.length === 1) {
    // Complete verb
    const partial = tokens[0].toLowerCase();
    const matches = VERBS.filter((v) => v.startsWith(partial));
    if (matches.length === 1) {
      input.value = matches[0] + " ";
    } else if (matches.length > 1) {
      const lcp = longestCommonPrefix(matches);
      if (lcp.length > partial.length) input.value = lcp;
      addLogEntry(matches.join("  "), "meta");
    }
    return;
  }

  const verb = tokens[0].toLowerCase();

  if (tokens.length === 2) {
    const partial = tokens[1].toLowerCase();

    if (verb === "status") {
      // Complete status noun
      const matches = STATUS_NOUNS.filter((n) => n.startsWith(partial));
      if (matches.length === 1) {
        input.value = `${tokens[0]} ${matches[0]} `;
      } else if (matches.length > 1) {
        const lcp = longestCommonPrefix(matches);
        if (lcp.length > partial.length) input.value = `${tokens[0]} ${lcp}`;
        addLogEntry(matches.join("  "), "meta");
      }
      return;
    }

    if (verb === "exploit" && s.selectedNodeId) {
      // Node already selected — complete card name
      const candidates = s.player.hand.filter(
        (c) => c.decayState !== "disclosed" && c.name.toLowerCase().startsWith(partial)
      );
      if (candidates.length === 1) {
        input.value = `${tokens[0]} ${candidates[0].name} `;
      } else if (candidates.length > 1) {
        const lcp = longestCommonPrefix(candidates.map((c) => c.name.toLowerCase()));
        if (lcp.length > partial.length) input.value = `${tokens[0]} ${lcp}`;
        addLogEntry(candidates.map((c) => c.name).join("  "), "meta");
      }
    } else if (["select", "probe", "exploit", "read", "loot", "reconfigure"].includes(verb)) {
      // Complete node
      const candidates = Object.values(s.nodes)
        .filter((n) => n.visibility !== "hidden")
        .filter((n) => n.id.startsWith(partial) || n.label.toLowerCase().startsWith(partial));

      if (candidates.length === 1) {
        input.value = `${tokens[0]} ${candidates[0].id} `;
      } else if (candidates.length > 1) {
        const lcp = longestCommonPrefix(candidates.map((n) => n.id));
        if (lcp.length > partial.length) input.value = `${tokens[0]} ${lcp}`;
        addLogEntry(candidates.map((n) => n.id).join("  "), "meta");
      }
    }
    return;
  }

  if (tokens.length === 3 && verb === "exploit") {
    // Complete card name (explicit form: exploit <node> <card>)
    const cardPartial = tokens.slice(2).join(" ").toLowerCase();
    const candidates = s.player.hand.filter(
      (c) => c.decayState !== "disclosed" && c.name.toLowerCase().startsWith(cardPartial)
    );
    if (candidates.length === 1) {
      input.value = `${tokens[0]} ${tokens[1]} ${candidates[0].name} `;
    } else if (candidates.length > 1) {
      const lcp = longestCommonPrefix(candidates.map((c) => c.name.toLowerCase()));
      if (lcp.length > cardPartial.length) input.value = `${tokens[0]} ${tokens[1]} ${lcp}`;
      addLogEntry(candidates.map((c) => c.name).join("  "), "meta");
    }
  }

  if (tokens.length === 3 && verb === "status" && tokens[1].toLowerCase() === "node") {
    // Complete node id for: status node <id>
    const partial = tokens[2].toLowerCase();
    const candidates = Object.values(s.nodes)
      .filter((n) => n.visibility !== "hidden")
      .filter((n) => n.id.startsWith(partial) || n.label.toLowerCase().startsWith(partial));
    if (candidates.length === 1) {
      input.value = `${tokens[0]} ${tokens[1]} ${candidates[0].id} `;
    } else if (candidates.length > 1) {
      const lcp = longestCommonPrefix(candidates.map((n) => n.id));
      if (lcp.length > partial.length) input.value = `${tokens[0]} ${tokens[1]} ${lcp}`;
      addLogEntry(candidates.map((n) => n.id).join("  "), "meta");
    }
  }
}
