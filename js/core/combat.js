// @ts-check
// Combat-balance constant re-export shim.
//
// The old card-combat path (exploit resolution, per-card decay, skip-to-owned)
// was retired in the E1 exploit-hoard rework: XPLOIT now launches the coherence
// auto-burn process
// (js/core/autoburn.js), and access collapsed to two tiers (locked → owned), so
// the three-tier ladder and the `"open"` intermediate those functions wrote no
// longer exist.
//
// This file survives only as a re-export of the combat-balance constants (the
// values live in balance.js since #169) so any `import … from "./combat.js"`
// site keeps working.

export { GRADE_MODIFIER, MATCH_BONUS, SUCCESS_CAP, PATCH_LAG } from "./balance.js";
