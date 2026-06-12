// @ts-check
/**
 * Canonical action ID constants. Import these instead of using raw strings
 * so renames are a single-file change.
 *
 * Usage:  import { A } from "../action-ids.js";
 *         if (action === A.PROBE) { ... }
 *
 * Convention: the constant name is the UPPER_CASE form of the string value.
 */

/** @enum {string} */
export const A = Object.freeze({
  // Hot-path player actions
  PROBE: "probe",
  XPLOIT: "xploit",
  DUMP: "dump",
  FETCH: "fetch",
  MINE: "mine",
  ABORT: "abort",
  TARGET: "target",
  UNTARGET: "untarget",
  JACKOUT: "jackout",
  KICK: "kick",
  REBOOT: "reboot",

  // Node-specific actions
  EXEC: "exec",
  CORRUPT: "corrupt",
  SPOOF: "spoof",
  CANCEL_TRACE: "cancel-trace",
  ACCESS_DARKNET: "access-darknet",
  SCRUB_LOGS: "scrub-logs",
  LIE_LOW: "lie-low",
});
