// @ts-check
// Completion providers and the tabComplete() entry point.

/** @typedef {import('../types.js').GameState} GameState */
/** @typedef {import('../types.js').ExploitCard} ExploitCard */
/** @typedef {import('../types.js').NodeState} NodeState */

import { registry } from "./registry.js";
import { VULNERABILITY_TYPES } from "../exploits.js";

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
export function buildResult(prefix, partial, insertTexts, displayTexts) {
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
export function fromList(candidates, partial) {
  const lc = partial.toLowerCase();
  const matches = candidates.filter(c => c.toLowerCase().startsWith(lc));
  return { insertTexts: matches, displayTexts: matches };
}

/**
 * Returns the stable alias map for revealed (???) nodes.
 * Aliases are assigned when a node is first revealed and stored in node.sigAlias.
 * @param {Object.<string, NodeState>} nodes
 * @returns {Map<string, string>}  nodeId → alias
 */
export function getRevealedAliases(nodes) {
  const map = new Map();
  for (const n of Object.values(nodes)) {
    if (n.visibility === "revealed" && n.sigAlias) map.set(n.id, n.sigAlias);
  }
  return map;
}

/**
 * Node completion: matches accessible nodes by id/label prefix, revealed nodes by alias.
 * Hidden nodes and revealed nodes' real identities are excluded.
 * @param {Object.<string, NodeState>} nodes
 * @param {string} partial
 * @returns {{ insertTexts: string[], displayTexts: string[] }}
 */
export function fromNodes(nodes, partial) {
  const lc = partial.toLowerCase();
  const revAliases = getRevealedAliases(nodes);
  const insertTexts = [];
  const displayTexts = [];
  for (const n of Object.values(nodes)) {
    if (n.visibility === "hidden") continue;
    if (n.visibility === "revealed") {
      const alias = revAliases.get(n.id) ?? n.id;
      if (alias.toLowerCase().startsWith(lc)) {
        insertTexts.push(alias);
        displayTexts.push(alias);
      }
    } else {
      if (n.id.toLowerCase().startsWith(lc) || n.label.toLowerCase().startsWith(lc)) {
        insertTexts.push(n.id);
        displayTexts.push(n.id);
      }
    }
  }
  return { insertTexts, displayTexts };
}

/**
 * Card completion: matches by id prefix or name prefix; inserts id when matched
 * by id, name when matched by name.  Disclosed cards are excluded.
 * Suggestions show "id  name" for readability.
 * @param {ExploitCard[]} hand
 * @param {string} partial
 * @returns {{ insertTexts: string[], displayTexts: string[] }}
 */
export function fromCards(hand, partial) {
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
export function fromVulnIds(partial) {
  const lc = partial.toLowerCase();
  const matches = VULNERABILITY_TYPES.filter(v => v.id.toLowerCase().startsWith(lc));
  return {
    insertTexts: matches.map(v => v.id),
    displayTexts: matches.map(v => `${v.id}  ${v.name}`),
  };
}

/** Complete a single optional node argument.  Used by several commands. */
export function completeNodeArg(args, partial, state) {
  return args.length === 0 ? fromNodes(state.nodes, partial) : null;
}

// ── tabComplete ───────────────────────────────────────────────────────────────

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
