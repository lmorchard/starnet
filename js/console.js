// Console — keyboard command input for the log pane
// Handles input, history, tab completion, and command dispatch.

import { addLogEntry, getState } from "./state.js";

const VERBS = ["probe", "exploit", "read", "loot", "reconfigure", "jackout", "cheat"];

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
    case "probe":        return cmdProbe(args);
    case "exploit":      return cmdExploit(args);
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

function resolveCard(token) {
  const s = getState();
  if (!token) return null;
  const lower = token.toLowerCase();

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

function cmdProbe(args) {
  if (args.length < 1) { addLogEntry("Usage: probe <node>", "error"); return; }
  const node = resolveNode(args[0]);
  if (!node) return;
  dispatch("starnet:action:probe", { nodeId: node.id });
}

function cmdExploit(args) {
  if (args.length < 2) { addLogEntry("Usage: exploit <node> <card>", "error"); return; }
  const node = resolveNode(args[0]);
  if (!node) return;
  // Card token may be multiple words — rejoin everything after the node token
  const cardToken = args.slice(1).join(" ");
  const card = resolveCard(cardToken);
  if (!card) return;
  dispatch("starnet:action:launch-exploit", { nodeId: node.id, exploitId: card.id });
}

function cmdRead(args) {
  if (args.length < 1) { addLogEntry("Usage: read <node>", "error"); return; }
  const node = resolveNode(args[0]);
  if (!node) return;
  dispatch("starnet:action:read", { nodeId: node.id });
}

function cmdLoot(args) {
  if (args.length < 1) { addLogEntry("Usage: loot <node>", "error"); return; }
  const node = resolveNode(args[0]);
  if (!node) return;
  dispatch("starnet:action:loot", { nodeId: node.id });
}

function cmdReconfigure(args) {
  if (args.length < 1) { addLogEntry("Usage: reconfigure <node>", "error"); return; }
  const node = resolveNode(args[0]);
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
      addLogEntry(matches.join("  "), "meta");
    }
    return;
  }

  const verb = tokens[0].toLowerCase();

  if (tokens.length === 2) {
    // Complete node (for all node-taking commands except cheat)
    if (["probe", "exploit", "read", "loot", "reconfigure"].includes(verb)) {
      const partial = tokens[1].toLowerCase();
      const candidates = Object.values(s.nodes)
        .filter((n) => n.visibility !== "hidden")
        .filter((n) => n.id.startsWith(partial) || n.label.toLowerCase().startsWith(partial));

      if (candidates.length === 1) {
        input.value = `${tokens[0]} ${candidates[0].id} `;
      } else if (candidates.length > 1) {
        addLogEntry(candidates.map((n) => n.id).join("  "), "meta");
      }
    }
    return;
  }

  if (tokens.length === 3 && verb === "exploit") {
    // Complete card name
    const partial = tokens.slice(2).join(" ").toLowerCase();
    const candidates = s.player.hand.filter(
      (c) => c.decayState !== "disclosed" && c.name.toLowerCase().startsWith(partial)
    );
    if (candidates.length === 1) {
      input.value = `${tokens[0]} ${tokens[1]} ${candidates[0].name} `;
    } else if (candidates.length > 1) {
      addLogEntry(candidates.map((c) => c.name).join("  "), "meta");
    }
  }
}
