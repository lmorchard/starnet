// @ts-check
// Shared resolve helpers used by command execute() functions.

import { getState } from "../state.js";
import { addLogEntry } from "../log.js";
import { emitEvent } from "../events.js";
import { getObscuredAliases } from "./completions.js";
import { isObscured } from "../state/node.js";

/**
 * Resolve a node token (id, label prefix, or sig-N alias) to a NodeState.
 * Known (accessible, non-obscured) nodes match by real id or label prefix.
 * Obscured nodes (revealed, or accessible-but-unprobed) match by alias only —
 * their real id/label stay hidden until probed.
 */
export function resolveNode(token) {
  const s = getState();
  if (!token) return null;
  const lower = token.toLowerCase();

  // Known nodes (accessible and not obscured): match by real id or label prefix.
  const byId = s.nodes[token];
  if (byId && byId.visibility === "accessible" && !isObscured(byId)) return byId;

  const labelMatches = Object.values(s.nodes).filter(
    (n) => n.visibility === "accessible" && !isObscured(n) && n.label?.toLowerCase().startsWith(lower)
  );
  if (labelMatches.length === 1) return labelMatches[0];
  if (labelMatches.length > 1) {
    addLogEntry(`Ambiguous node: ${labelMatches.map((n) => n.id).join(", ")}`, "error");
    return null;
  }

  // Obscured nodes: match by alias only (real id/label are hidden).
  const obscuredAliases = getObscuredAliases(s.nodes);
  for (const [nodeId, alias] of obscuredAliases) {
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
    addLogEntry("No node targeted. Use: target <node>", "error");
    return null;
  }
  return s.nodes[nodeId];
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
