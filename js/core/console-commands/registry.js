// @ts-check
// Command registry — stores CommandDef objects by verb.
// Shared between all console-commands sub-modules and console.js (for overrides).

/** @typedef {import('../types.js').GameState} GameState */

/**
 * A console command: verb identity, optional tab-completion, optional execution.
 *
 * complete(args, partial, state):
 *   args    — committed tokens after the verb (lowercase), excluding partial
 *   partial — the token currently being typed
 *   state   — current game state (read-only)
 *   Returns { insertTexts, displayTexts } or null for "no completions here".
 *
 * execute(args):
 *   args — tokens after the verb (raw case preserved)
 *
 * @typedef {{
 *   verb: string,
 *   complete?: ((args: string[], partial: string, state: GameState) =>
 *     { insertTexts: string[], displayTexts: string[] } | null) | null,
 *   execute?: ((args: string[]) => void) | null,
 * }} CommandDef
 */

/** @type {Map<string, CommandDef>} */
export const registry = new Map();

/**
 * Register (or replace) a command definition.
 * Called at module init for all core commands; called again by console.js to
 * override browser-specific sub-commands (e.g. cheat relayout/restore).
 * @param {CommandDef} def
 */
export function registerCommand(def) {
  registry.set(def.verb, def);
}

/**
 * Look up a command by verb.
 * @param {string} verb
 * @returns {CommandDef|undefined}
 */
export function getCommand(verb) {
  return registry.get(verb);
}
