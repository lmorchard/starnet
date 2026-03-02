// @ts-check
// Pure tab completion — no DOM dependencies, fully testable.
//
// tabComplete(rawInput, state) → { completed: string|null, suggestions: string[] }
//
// The browser layer (console.js) applies the result to input.value and logs
// suggestions. The playtest harness can call this directly for automated testing.
//
// Design: schema-driven completion.  Each verb knows what to complete at each
// argument position.  Adding a new command means adding a case here; no other
// file needs changing.

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').ExploitCard} ExploitCard */
/** @typedef {import('./types.js').NodeState} NodeState */

import { VULNERABILITY_TYPES } from "./exploits.js";

// ── Public constants (used by console.js handleCommand switch) ────────────────

export const VERBS = [
  "select", "deselect", "probe", "exploit", "eject", "reboot", "read", "loot",
  "reconfigure", "cancel-probe", "cancel-exploit", "cancel-read", "cancel-loot",
  "cancel-trace", "jackout", "status", "actions", "store", "buy", "log", "help", "cheat",
];

// ── Private constants ─────────────────────────────────────────────────────────

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
 *
 * @param {string} prefix       - committed tokens + trailing space (e.g. "exploit ")
 * @param {string} partial      - the token being typed (may be "")
 * @param {string[]} insertTexts - what to insert for each candidate
 * @param {string[]} [displayTexts] - what to show in suggestions (defaults to insertTexts)
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
 * Node completion: matches by id prefix or label prefix; always inserts the id.
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
 * Card completion: matches by id prefix or name prefix; inserts id when
 * matched by id, name when matched by name.  Disclosed cards are excluded.
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
  const displayTexts = matches.map(c => `${c.id}  ${c.name}`);
  return { insertTexts, displayTexts };
}

/**
 * Vuln-id completion: inserts the vuln id, shows "id  name" in suggestions.
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

// ── Cheat sub-tree ────────────────────────────────────────────────────────────

/**
 * @param {string[]} cheatArgs  - tokens after "cheat", excluding the partial
 * @param {string} prefix
 * @param {string} partial
 * @param {GameState} state
 * @returns {{ completed: string|null, suggestions: string[] }}
 */
function completeCheat(cheatArgs, prefix, partial, state) {
  if (cheatArgs.length === 0) {
    const { insertTexts, displayTexts } = fromList(CHEAT_SUBS, partial);
    return buildResult(prefix, partial, insertTexts, displayTexts);
  }

  const sub = cheatArgs[0];
  const subArgs = cheatArgs.slice(1);

  if (sub === "give") {
    if (subArgs.length === 0) {
      const { insertTexts, displayTexts } = fromList(CHEAT_GIVE_SUBS, partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
    if (subArgs[0] === "matching" && subArgs.length === 1) {
      const { insertTexts, displayTexts } = fromNodes(state.nodes, partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
    if (subArgs[0] === "card" && subArgs.length === 1) {
      const { insertTexts, displayTexts } = fromList(CHEAT_RARITIES, partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
  }

  if (sub === "set") {
    if (subArgs.length === 0) {
      const { insertTexts, displayTexts } = fromList(["alert"], partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
    if (subArgs[0] === "alert" && subArgs.length === 1) {
      const { insertTexts, displayTexts } = fromList(CHEAT_ALERTS, partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
  }

  if (sub === "own" && subArgs.length === 0) {
    const { insertTexts, displayTexts } = fromNodes(state.nodes, partial);
    return buildResult(prefix, partial, insertTexts, displayTexts);
  }

  if (sub === "trace" && subArgs.length === 0) {
    const { insertTexts, displayTexts } = fromList(CHEAT_TRACE_SUBS, partial);
    return buildResult(prefix, partial, insertTexts, displayTexts);
  }

  if ((sub === "summon-ice" || sub === "teleport-ice") && subArgs.length === 0) {
    const { insertTexts, displayTexts } = fromNodes(state.nodes, partial);
    return buildResult(prefix, partial, insertTexts, displayTexts);
  }

  return { completed: null, suggestions: [] };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Pure tab completion.  No DOM, no I/O — call from handleTabComplete (browser)
 * or tests (headless).
 *
 * @param {string} rawInput   - current value of the console input field
 * @param {GameState} state   - current game state (read-only)
 * @returns {{ completed: string|null, suggestions: string[] }}
 *   completed  — the new input value to set (null = leave unchanged)
 *   suggestions — strings to display in the log as hints
 */
export function tabComplete(rawInput, state) {
  const tokens = rawInput.split(/\s+/);
  const partial = tokens[tokens.length - 1];
  const committed = tokens.slice(0, -1).map(t => t.toLowerCase());
  const prefix = committed.length > 0 ? committed.join(" ") + " " : "";

  // ── Verb completion ───────────────────────────────────────
  if (committed.length === 0) {
    const { insertTexts, displayTexts } = fromList(VERBS, partial);
    return buildResult("", partial, insertTexts, displayTexts);
  }

  const verb = committed[0];
  const args = committed.slice(1); // tokens after the verb, excluding partial

  // ── Commands whose first arg is an optional node ──────────
  if (["select", "probe", "read", "loot", "reconfigure", "reboot"].includes(verb)) {
    if (args.length === 0) {
      const { insertTexts, displayTexts } = fromNodes(state.nodes, partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
    return { completed: null, suggestions: [] };
  }

  // ── exploit ──────────────────────────────────────────────
  if (verb === "exploit") {
    if (args.length === 0 && state.selectedNodeId) {
      // Implicit form: exploit <card>  (node already selected)
      const { insertTexts, displayTexts } = fromCards(state.player.hand, partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
    if (args.length === 0) {
      // No node selected — complete the node first
      const { insertTexts, displayTexts } = fromNodes(state.nodes, partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
    if (args.length === 1) {
      // Explicit form: exploit <node> <card>
      const { insertTexts, displayTexts } = fromCards(state.player.hand, partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
    return { completed: null, suggestions: [] };
  }

  // ── status ────────────────────────────────────────────────
  if (verb === "status") {
    if (args.length === 0) {
      const { insertTexts, displayTexts } = fromList(STATUS_NOUNS, partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
    if (args[0] === "node" && args.length === 1) {
      const { insertTexts, displayTexts } = fromNodes(state.nodes, partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
    return { completed: null, suggestions: [] };
  }

  // ── buy ───────────────────────────────────────────────────
  if (verb === "buy") {
    if (args.length === 0) {
      const { insertTexts, displayTexts } = fromVulnIds(partial);
      return buildResult(prefix, partial, insertTexts, displayTexts);
    }
    return { completed: null, suggestions: [] };
  }

  // ── cheat ─────────────────────────────────────────────────
  if (verb === "cheat") {
    return completeCheat(args, prefix, partial, state);
  }

  return { completed: null, suggestions: [] };
}
