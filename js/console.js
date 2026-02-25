// Console — keyboard command input for the log pane
// Handles input, history, tab completion, and command dispatch.

import { getState } from "./state.js";
import { addLogEntry, getRecentLog } from "./log-renderer.js";
import { getVisibleTimers } from "./timers.js";

const VERBS = ["select", "deselect", "probe", "exploit", "escalate", "eject", "reboot", "read", "loot", "reconfigure", "jackout", "status", "log", "help", "cheat"];
const STATUS_NOUNS = ["ice", "hand", "node", "alert", "mission"];

let history = [];
let historyIndex = -1;

export function initConsole() {
  const input = document.getElementById("console-input");
  if (!input) return;

  input.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") {
      const raw = input.value.trim();
      input.value = "";
      historyIndex = -1;
      if (!raw) return;
      history.unshift(raw);
      if (history.length > 50) history.length = 50;
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
  addLogEntry(`> ${raw}`, "command");
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
    case "exploit":
    case "escalate":     return cmdExploit(args);
    case "eject":        return cmdEject();
    case "reboot":       return cmdReboot(args);
    case "read":         return cmdRead(args);
    case "loot":         return cmdLoot(args);
    case "reconfigure":  return cmdReconfigure(args);
    case "jackout":      return cmdJackout();
    case "status":       return cmdStatus(args);
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
function handSortKey(card, node) {
  if (card.decayState === "disclosed") return 3;
  if (!node?.probed) return 1;
  const knownVulnIds = node.vulnerabilities
    .filter((v) => !v.patched && !v.hidden)
    .map((v) => v.id);
  return card.targetVulnTypes.some((t) => knownVulnIds.includes(t)) ? 0 : 2;
}

function resolveCard(token) {
  const s = getState();
  if (!token) return null;
  const lower = token.toLowerCase();

  // Numeric index (1-based) — matches the displayed sort order
  const num = parseInt(token, 10);
  if (!isNaN(num) && num >= 1 && num <= s.player.hand.length) {
    const selectedNode = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
    const hand = selectedNode
      ? [...s.player.hand].sort((a, b) => handSortKey(a, selectedNode) - handSortKey(b, selectedNode))
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

function dispatch(eventName, detail = {}) {
  document.dispatchEvent(
    new CustomEvent(eventName, { detail: { ...detail, fromConsole: true } })
  );
}

// ── Command implementations ───────────────────────────────

function cmdSelect(args) {
  if (args.length < 1) { addLogEntry("Usage: select <node>", "error"); return; }
  const node = resolveNode(args[0]);
  if (!node) return;
  dispatch("starnet:action:select", { nodeId: node.id });
}

function cmdDeselect() {
  dispatch("starnet:action:deselect");
}

function cmdProbe(args) {
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  dispatch("starnet:action:probe", { nodeId: node.id });
}

function cmdExploit(args) {
  const s = getState();
  if (args.length >= 2) {
    // Explicit form: exploit <node> <card>
    const node = resolveNode(args[0]);
    if (!node) return;
    const card = resolveCard(args.slice(1).join(" "));
    if (!card) return;
    dispatch("starnet:action:launch-exploit", { nodeId: node.id, exploitId: card.id });
  } else if (args.length === 1 && s.selectedNodeId) {
    // Implicit form: exploit <card>  (uses selected node)
    const node = resolveImplicitNode();
    if (!node) return;
    const card = resolveCard(args[0]);
    if (!card) return;
    dispatch("starnet:action:launch-exploit", { nodeId: node.id, exploitId: card.id });
  } else {
    addLogEntry("Usage: exploit <node> <card>  (or select a node first: exploit <card>)", "error");
  }
}

function cmdRead(args) {
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  dispatch("starnet:action:read", { nodeId: node.id });
}

function cmdLoot(args) {
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  dispatch("starnet:action:loot", { nodeId: node.id });
}

function cmdReconfigure(args) {
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  dispatch("starnet:action:reconfigure", { nodeId: node.id });
}

function cmdEject() {
  const s = getState();
  if (!s.ice?.active || s.ice.attentionNodeId !== s.selectedNodeId) {
    addLogEntry("No ICE present at selected node.", "error");
    return;
  }
  dispatch("starnet:action:eject", { nodeId: s.selectedNodeId });
}

function cmdReboot(args) {
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  if (node.accessLevel !== "owned") {
    addLogEntry(`${node.label}: must be owned to reboot.`, "error");
    return;
  }
  dispatch("starnet:action:reboot", { nodeId: node.id });
}

function cmdStatus(args) {
  const noun = args[0]?.toLowerCase();
  if (!noun) return cmdStatusFull();
  switch (noun) {
    case "ice":     return cmdStatusIce();
    case "hand":    return cmdStatusHand();
    case "node":    return cmdStatusNode(args.slice(1));
    case "alert":   return cmdStatusAlert();
    case "mission": return cmdStatusMission();
    default:
      addLogEntry(`Unknown status noun: ${noun}. Try: ice hand node alert mission`, "error");
  }
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
    const pos      = s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId;
    const resident = s.nodes[s.ice.residentNodeId]?.label  ?? s.ice.residentNodeId;
    lines.push(`- status: ACTIVE  grade: ${s.ice.grade}`);
    lines.push(`- attention: ${pos}  resident: ${resident}`);
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
  const revealedCount = Object.values(s.nodes).filter((n) => n.visibility === "revealed").length;

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

  if (revealedCount > 0) lines.push(`- ${revealedCount} node(s) revealed (inaccessible)`);

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
    const pos      = s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId;
    const resident = s.nodes[s.ice.residentNodeId]?.label  ?? s.ice.residentNodeId;
    lines.push(`- status: ACTIVE  grade: ${s.ice.grade}`);
    lines.push(`- attention: ${pos}  resident: ${resident}`);
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
    ? [...s.player.hand].sort((a, b) => handSortKey(a, selectedNode) - handSortKey(b, selectedNode))
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
  if (s.ice?.active && s.ice.attentionNodeId === node.id) {
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
    "  escalate [node] <card>    Alias for exploit.",
    "  read [node]               Scan node contents.",
    "  loot [node]               Collect macguffins from owned node.",
    "  reconfigure [node]        Disable IDS event forwarding.",
    "  eject                     Push ICE attention to adjacent node.",
    "  reboot [node]             Send ICE home. Node offline briefly.",
    "  jackout                   Disconnect and end run.",
    "  status [noun]             Game state. Nouns: ice hand node alert mission",
    "  log [n]                   Replay last n log entries (default: 20).",
    "  help                      Show this listing.",
    "  // CHEAT — playtesting only. Cheaters never win.",
    "  cheat give card [rarity]  Add exploit card. Rarities: common uncommon rare",
    "  cheat give cash <amount>  Add credits to wallet.",
    "  cheat set alert <level>   Force alert level: green yellow red trace",
    "  cheat own <node>          Set node to owned + reveal neighbors.",
  ];
  lines.forEach((line) => addLogEntry(line, "meta"));
}

function cmdJackout() {
  dispatch("starnet:action:jackout");
}

function cmdCheat(args) {
  // Forwarded to cheats module — loaded lazily to keep cheat code isolated
  import("./cheats.js").then(({ handleCheatCommand }) => {
    handleCheatCommand(args);
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
