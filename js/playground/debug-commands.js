// @ts-check
/**
 * Playground debug commands — extends the console with circuit debugging tools.
 * Registered via the standard command registry, works alongside game commands.
 */

import { getState } from "../core/state.js";
import { addLogEntry } from "../core/log.js";
import { registerCommand } from "../core/console-commands/registry.js";
import { createMessage } from "../core/node-graph/message.js";

/**
 * Parse a value string into the appropriate JS type.
 * "true" → true, "false" → false, "null" → null, numeric → number, else string.
 * @param {string} str
 * @returns {any}
 */
function parseValue(str) {
  if (str === "true") return true;
  if (str === "false") return false;
  if (str === "null") return null;
  const num = Number(str);
  if (!isNaN(num) && str.trim() !== "") return num;
  // Strip quotes if present
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

/**
 * Register all playground debug commands.
 */
export function registerDebugCommands() {
  registerCommand({
    verb: "inject",
    execute(args) {
      if (args.length < 2) {
        addLogEntry("Usage: inject <nodeId> <msgType> [key=val ...]", "error");
        return;
      }
      const [nodeId, msgType, ...kvPairs] = args;
      const s = getState();
      if (!s.nodeGraph) { addLogEntry("No graph loaded.", "error"); return; }

      // Parse optional key=value payload pairs
      const payload = {};
      for (const kv of kvPairs) {
        const eq = kv.indexOf("=");
        if (eq > 0) {
          payload[kv.slice(0, eq)] = parseValue(kv.slice(eq + 1));
        }
      }

      try {
        const msg = createMessage({ type: msgType, origin: nodeId, payload });
        s.nodeGraph.sendMessage(nodeId, msg);
        addLogEntry(`[DEBUG] Injected ${msgType} → ${nodeId}`, "meta");
      } catch (e) {
        addLogEntry(`[DEBUG] Error: ${e.message}`, "error");
      }
    },
  });

  registerCommand({
    verb: "set",
    execute(args) {
      if (args.length < 3) {
        addLogEntry("Usage: set <nodeId> <attr> <value>", "error");
        return;
      }
      const [nodeId, attr, ...rest] = args;
      const value = parseValue(rest.join(" "));
      const s = getState();
      if (!s.nodeGraph) { addLogEntry("No graph loaded.", "error"); return; }

      try {
        s.nodeGraph.setNodeAttr(nodeId, attr, value);
        addLogEntry(`[DEBUG] ${nodeId}.${attr} = ${JSON.stringify(value)}`, "meta");
      } catch (e) {
        addLogEntry(`[DEBUG] Error: ${e.message}`, "error");
      }
    },
  });

  registerCommand({
    verb: "inspect",
    execute(args) {
      if (args.length < 1) {
        addLogEntry("Usage: inspect <nodeId>", "error");
        return;
      }
      const nodeId = args[0];
      const s = getState();
      if (!s.nodeGraph) { addLogEntry("No graph loaded.", "error"); return; }

      try {
        const attrs = s.nodeGraph.getNodeState(nodeId);
        addLogEntry(`[INSPECT] ${nodeId}`, "meta");
        for (const [key, val] of Object.entries(attrs)) {
          addLogEntry(`  ${key}: ${JSON.stringify(val)}`, "meta");
        }
      } catch (e) {
        addLogEntry(`[DEBUG] Error: ${e.message}`, "error");
      }
    },
  });

  registerCommand({
    verb: "triggers",
    execute() {
      const s = getState();
      if (!s.nodeGraph) { addLogEntry("No graph loaded.", "error"); return; }

      const snapshot = s.nodeGraph.snapshot();
      const triggers = snapshot.triggers ?? [];
      if (triggers.length === 0) {
        addLogEntry("[TRIGGERS] No triggers defined.", "meta");
        return;
      }
      addLogEntry(`[TRIGGERS] ${triggers.length} trigger(s):`, "meta");
      for (const t of triggers) {
        const status = t.fired ? (t.repeating ? "FIRED (repeating)" : "FIRED (one-shot)") : "ARMED";
        addLogEntry(`  ${t.id}: ${status}`, "meta");
      }
    },
  });

  registerCommand({
    verb: "messages",
    execute(args) {
      const el = document.getElementById("toggle-messages");
      if (!el) return;
      if (args[0] === "on") el.checked = true;
      else if (args[0] === "off") el.checked = false;
      else el.checked = !el.checked;
      el.dispatchEvent(new Event("change"));
      addLogEntry(`[DEBUG] Message trace: ${el.checked ? "ON" : "OFF"}`, "meta");
    },
  });

  registerCommand({
    verb: "qualities",
    execute() {
      const s = getState();
      if (!s.nodeGraph) { addLogEntry("No graph loaded.", "error"); return; }

      const snapshot = s.nodeGraph.snapshot();
      const qualities = snapshot.qualities ?? {};
      const entries = Object.entries(qualities);
      if (entries.length === 0) {
        addLogEntry("[QUALITIES] No qualities set.", "meta");
        return;
      }
      addLogEntry(`[QUALITIES] ${entries.length} quality(ies):`, "meta");
      for (const [name, value] of entries) {
        addLogEntry(`  ${name}: ${value}`, "meta");
      }
    },
  });

  registerCommand({
    verb: "graph",
    execute() {
      const s = getState();
      if (!s.nodeGraph) { addLogEntry("No graph loaded.", "error"); return; }

      const snapshot = s.nodeGraph.snapshot();
      const json = JSON.stringify(snapshot, null, 2);
      addLogEntry("[GRAPH] Full snapshot:", "meta");
      // Split into lines to avoid one massive log entry
      for (const line of json.split("\n").slice(0, 100)) {
        addLogEntry(line, "meta");
      }
      if (json.split("\n").length > 100) {
        addLogEntry("  ... (truncated, use JSON inspector for full view)", "meta");
      }
    },
  });

  registerCommand({
    verb: "nodes",
    execute() {
      const s = getState();
      if (!s.nodeGraph) { addLogEntry("No graph loaded.", "error"); return; }

      addLogEntry("[NODES]", "meta");
      for (const nodeId of s.nodeGraph.getNodeIds()) {
        const attrs = s.nodeGraph.getNodeState(nodeId);
        const type = attrs.type ?? "unknown";
        const vis = attrs.visibility ?? "?";
        const access = attrs.accessLevel ?? "?";
        addLogEntry(`  ${nodeId} [${type}] vis:${vis} access:${access}`, "meta");
      }
    },
  });

  registerCommand({
    verb: "edges",
    execute() {
      const s = getState();
      if (!s.nodeGraph) { addLogEntry("No graph loaded.", "error"); return; }

      const edges = s.nodeGraph.getEdges();
      addLogEntry(`[EDGES] ${edges.length} edge(s):`, "meta");
      for (const [a, b] of edges) {
        addLogEntry(`  ${a} ↔ ${b}`, "meta");
      }
    },
  });
}
