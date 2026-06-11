// @ts-check
/**
 * Core/script partition. A node-contextual action is a "script" (grouped under
 * the EXEC submenu/verb) iff its id is NOT in the core deck-verb allowlist.
 * New set-piece-authored node actions become scripts automatically.
 */
import { A } from "../action-ids.js";

/** @type {Set<string>} Core node verbs that stay top-level (never grouped under EXEC). */
export const CORE_NODE_VERBS = new Set([
  A.PROBE, A.XPLOIT, A.DUMP, A.FETCH, A.MINE, A.KICK,
  A.REBOOT, A.ABORT, A.TARGET, A.UNTARGET, A.JACKOUT,
  A.EXEC, // synthetic submenu action — not itself a script
]);

/** @param {string} id @returns {boolean} */
export function isScriptAction(id) {
  return !CORE_NODE_VERBS.has(id);
}
