// Console — keyboard command input for the log pane
// Handles input, history, tab completion, and command dispatch.

import { addLogEntry, getState } from "./state.js";

const VERBS = ["select", "deselect", "probe", "exploit", "escalate", "read", "loot", "reconfigure", "jackout", "cheat"];

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
    case "read":         return cmdRead(args);
    case "loot":         return cmdLoot(args);
    case "reconfigure":  return cmdReconfigure(args);
    case "jackout":      return cmdJackout();
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
}
