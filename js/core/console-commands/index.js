// @ts-check
// Entry point for the console command system.
//
// Imports all sub-modules to register core commands, then re-exports the
// public API. External code imports from this file (or the flat alias below).
//
// Sub-module layout:
//   registry.js    — CommandDef typedef, registry Map, registerCommand, getCommand
//   completions.js — completion providers, getRevealedAliases, tabComplete
//   resolvers.js   — resolveNode/Card/ImplicitNode, dispatch, resolveWanAccess
//   cmd-status.js  — status sub-command implementations
//   commands.js    — all CommandDef objects

export { registerCommand, getCommand } from "./registry.js";
export { tabComplete, getRevealedAliases } from "./completions.js";

import { registry, registerCommand } from "./registry.js";
import { COMMANDS } from "./commands.js";

COMMANDS.forEach(registerCommand);

/**
 * All recognized console verbs, derived from the registry after core registration.
 * Snapshot taken here; tabComplete() reads the live registry so browser overrides
 * are reflected automatically.
 * @type {string[]}
 */
export const VERBS = [...registry.keys()];
