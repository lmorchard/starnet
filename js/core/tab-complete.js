// @ts-check
// Pure tab completion — no DOM dependencies, fully testable.
//
// tabComplete(rawInput, state) → { completed: string|null, suggestions: string[] }
//
// Design: command registry.  Each command is a CommandDef — a self-contained
// object that owns both its verb identity and its completion behavior.
// Adding a new command means adding one entry to COMMANDS; nothing else changes.
// VERBS is derived from the registry, not maintained as a parallel list.
//
// Completion providers (fromList, fromNodes, fromCards, fromVulnIds) are shared
// helpers that CommandDef.complete() functions call.
//
// The browser layer (console.js) applies results to input.value + logs suggestions.
// Tests construct minimal state objects and call tabComplete() directly.

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').ExploitCard} ExploitCard */
/** @typedef {import('./types.js').NodeState} NodeState */

import { VULNERABILITY_TYPES } from "./exploits.js";

// ── Shared constants ──────────────────────────────────────────────────────────

const STATUS_NOUNS    = ["summary", "ice", "hand", "node", "alert", "mission"];
const CHEAT_SUBS      = ["give", "set", "own", "own-all", "trace", "summon-ice", "teleport-ice", "ice-state", "snapshot", "relayout", "restore", "help"];
const CHEAT_GIVE_SUBS = ["matching", "card", "cash"];
const CHEAT_RARITIES  = ["common", "uncommon", "rare"];
const CHEAT_ALERTS    = ["green", "yellow", "red", "trace"];
const CHEAT_TRACE_SUBS = ["start", "end"];

// ── Core helpers ──────────────────────────────────────────────────────────────

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

// ── Shared complete functions ─────────────────────────────────────────────────

/** Complete a single optional node argument.  Used by several commands. */
function completeNodeArg(args, partial, state) {
  return args.length === 0 ? fromNodes(state.nodes, partial) : null;
}

// ── Command registry ──────────────────────────────────────────────────────────

/**
 * A console command definition: verb identity + completion behaviour.
 *
 * complete(args, partial, state) receives:
 *   args    — the committed tokens after the verb (lowercase), excluding partial
 *   partial — the token currently being typed
 *   state   — current game state (read-only)
 * Returns a completion provider { insertTexts, displayTexts }, or null for
 * "no completions at this position."
 *
 * @typedef {{
 *   verb: string,
 *   complete?: ((args: string[], partial: string, state: GameState) =>
 *     { insertTexts: string[], displayTexts: string[] } | null) | null,
 * }} CommandDef
 */

/** @type {CommandDef[]} */
const COMMANDS = [

  // ── Node-arg commands ─────────────────────────────────────
  // These share the same pattern: optional single node as first argument.

  { verb: "select",      complete: completeNodeArg },
  { verb: "probe",       complete: completeNodeArg },
  { verb: "read",        complete: completeNodeArg },
  { verb: "loot",        complete: completeNodeArg },
  { verb: "reconfigure", complete: completeNodeArg },
  { verb: "reboot",      complete: completeNodeArg },

  // ── No-arg commands ───────────────────────────────────────
  // Completing the verb itself is sufficient; no argument completions.

  { verb: "deselect" },
  { verb: "eject" },
  { verb: "cancel-probe" },
  { verb: "cancel-exploit" },
  { verb: "cancel-read" },
  { verb: "cancel-loot" },
  { verb: "cancel-trace" },
  { verb: "jackout" },
  { verb: "actions" },
  { verb: "store" },
  { verb: "log" },
  { verb: "help" },

  // ── exploit ───────────────────────────────────────────────
  // Context-dependent: with selected node → complete card; without → node then card.

  {
    verb: "exploit",
    complete(args, partial, state) {
      if (args.length === 0 && state.selectedNodeId) {
        return fromCards(state.player.hand, partial);   // implicit: exploit <card>
      }
      if (args.length === 0) {
        return fromNodes(state.nodes, partial);          // explicit step 1: <node>
      }
      if (args.length === 1) {
        return fromCards(state.player.hand, partial);   // explicit step 2: <card>
      }
      return null;
    },
  },

  // ── status ────────────────────────────────────────────────
  // status <noun>  then, for "status node", status node <nodeId>

  {
    verb: "status",
    complete(args, partial, state) {
      if (args.length === 0) return fromList(STATUS_NOUNS, partial);
      if (args[0] === "node" && args.length === 1) return fromNodes(state.nodes, partial);
      return null;
    },
  },

  // ── buy ───────────────────────────────────────────────────
  // buy <vuln-id>  — complete from the full vulnerability catalogue

  {
    verb: "buy",
    complete(args, partial) {
      return args.length === 0 ? fromVulnIds(partial) : null;
    },
  },

  // ── cheat ─────────────────────────────────────────────────
  // Multi-level sub-command tree; each branch is self-contained below.

  {
    verb: "cheat",
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
  },
];

// Fast verb lookup — built once from the registry.
const COMMAND_MAP = new Map(COMMANDS.map(c => [c.verb, c]));

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * All recognized console verbs, derived from the command registry.
 * Used by console.js for handleCommand and handleTabComplete wiring.
 * @type {string[]}
 */
export const VERBS = COMMANDS.map(c => c.verb);

/**
 * Pure tab completion.  No DOM, no I/O.
 *
 * @param {string} rawInput   - current value of the console input field
 * @param {GameState} state   - current game state (read-only)
 * @returns {{ completed: string|null, suggestions: string[] }}
 *   completed  — new input value (null = leave unchanged)
 *   suggestions — hint strings to log
 */
export function tabComplete(rawInput, state) {
  const tokens = rawInput.split(/\s+/);
  const partial = tokens[tokens.length - 1];
  const committed = tokens.slice(0, -1).map(t => t.toLowerCase());
  const prefix = committed.length > 0 ? committed.join(" ") + " " : "";

  // No committed verb yet — complete the verb itself.
  if (committed.length === 0) {
    const { insertTexts, displayTexts } = fromList(VERBS, partial);
    return buildResult("", partial, insertTexts, displayTexts);
  }

  // Look up the command and delegate to its complete() function.
  const cmd = COMMAND_MAP.get(committed[0]);
  if (!cmd?.complete) return { completed: null, suggestions: [] };

  const args = committed.slice(1);
  const provider = cmd.complete(args, partial, state);
  if (!provider) return { completed: null, suggestions: [] };

  const { insertTexts, displayTexts } = provider;
  return buildResult(prefix, partial, insertTexts, displayTexts);
}
