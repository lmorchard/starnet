// @ts-check
// Shared resolve helpers used by command execute() functions.

import { getState } from "../state.js";
import { addLogEntry } from "../log.js";
import { emitEvent } from "../events.js";
import { exploitSortKey } from "../exploits.js";
import { getRevealedAliases } from "./completions.js";

/**
 * Resolve a node token (id, label prefix, or sig-N alias) to a NodeState.
 * Accessible nodes match by real id or label prefix.
 * Revealed nodes match by alias only — real id/label are hidden.
 */
export function resolveNode(token) {
  const s = getState();
  if (!token) return null;
  const lower = token.toLowerCase();

  // Accessible nodes: match by real id or label prefix.
  const byId = s.nodes[token];
  if (byId && byId.visibility === "accessible") return byId;

  const labelMatches = Object.values(s.nodes).filter(
    (n) => n.visibility === "accessible" && n.label.toLowerCase().startsWith(lower)
  );
  if (labelMatches.length === 1) return labelMatches[0];
  if (labelMatches.length > 1) {
    addLogEntry(`Ambiguous node: ${labelMatches.map((n) => n.id).join(", ")}`, "error");
    return null;
  }

  // Revealed nodes: match by alias only (real id/label are hidden).
  const revAliases = getRevealedAliases(s.nodes);
  for (const [nodeId, alias] of revAliases) {
    if (alias.toLowerCase() === lower) return s.nodes[nodeId];
  }

  addLogEntry(`Unknown node: ${token}`, "error");
  return null;
}

/** Resolve the currently-selected node, logging an error if none is selected. */
export function resolveImplicitNode() {
  const s = getState();
  const nodeId = s.selectedNodeId;
  if (!nodeId || !s.nodes[nodeId]) {
    addLogEntry("No node selected. Use: select <node>", "error");
    return null;
  }
  return s.nodes[nodeId];
}

/**
 * Resolve a card token (1-based index, id, or name prefix) to an ExploitCard.
 * Mirrors the sort order used by the hand pane when a node is selected.
 */
export function resolveCard(token) {
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

/** Emit a starnet:action event. */
export function dispatch(actionId, detail = {}) {
  emitEvent("starnet:action", { actionId, ...detail, fromConsole: true });
}

/**
 * Guard: returns true if the player has a WAN node selected and the game is playing.
 * Logs an error and returns false otherwise.
 */
export function resolveWanAccess() {
  const s = getState();
  if (s.phase !== "playing") { addLogEntry("Not connected to network.", "error"); return false; }
  if (s.nodes[s.selectedNodeId]?.type !== "wan") {
    addLogEntry("Access denied. Select WAN node first.", "error");
    return false;
  }
  return true;
}
