// @ts-check
// Browser binding for the persistent player profile: localStorage load/save and
// new-profile bootstrap. The pure model lives in js/core/profile.
//
// E1 hoard cutover (Phase 5): the profile carries a persistent `hoard` of exploit
// rounds. Launch clones the WHOLE hoard into the run (no loadout); run-end commits
// the final hoard back (clean) or leaves it intact (caught). v1 (card-inventory)
// profiles are discarded and re-bootstrapped — no migration.

import {
  createProfile,
  buildRunHoard,
  commitRun,
  withdraw,
  PROFILE_VERSION,
} from "../core/profile/index.js";
import { generateHoard, DEFAULT_START_HOARD } from "../core/hoard.js";
import { on, E } from "../core/events.js";
import { getState } from "../core/state.js";

/** @typedef {import('../core/types.js').StarnetProfile} StarnetProfile */

const PROFILE_KEY = "starnet:profile";
const DEFAULT_BANK = 1000; // matches initGame's startCash fallback

/**
 * Load the profile from localStorage, or bootstrap a new one if absent/corrupt.
 * v1 (card-inventory) profiles are discarded and re-bootstrapped — no migration.
 * v2 profiles are migrated gently to v3 (gear field added, bank/hoard preserved).
 * v3 profiles load and normalize as-is.
 * @returns {StarnetProfile}
 */
export function loadProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // v2 and v3 survive; v1 and anything older/missing is reset.
      if (parsed && typeof parsed === "object" && (parsed.version === 2 || parsed.version === PROFILE_VERSION)) {
        return normalizeProfile(parsed);
      }
    } catch {
      // unparseable payload — fall through and re-bootstrap
    }
  }
  return bootstrapProfile();
}

/**
 * Repair/migrate a parsed v2 or v3 profile to the current shape, filling missing or
 * invalid fields so a partially-written payload can't crash the hub downstream.
 * Mutates and returns the object.
 *
 * v2 → v3 migration: adds `gear: []` (preserving bank + hoard — NOT a reset).
 * Pre-v2 payloads never reach here — loadProfile resets them.
 * @param {any} p
 * @returns {StarnetProfile}
 */
function normalizeProfile(p) {
  if (typeof p.bank !== "number") p.bank = 0;
  if (!Array.isArray(p.hoard)) p.hoard = [];
  if (typeof p._hubVisits !== "number") p._hubVisits = 0;
  // v2 → v3: gentle migration — add gear field if missing, bump version.
  if (!Array.isArray(p.gear)) p.gear = [];
  if (typeof p.version !== "number" || p.version < PROFILE_VERSION) p.version = PROFILE_VERSION;
  return p;
}

/**
 * Persist the profile to localStorage.
 * @param {StarnetProfile} profile
 */
export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/**
 * Create and persist a starter profile: a default bank plus a generated starter
 * hoard. (The vestigial card inventory starts empty.)
 * @returns {StarnetProfile}
 */
function bootstrapProfile() {
  const p = createProfile({ bank: DEFAULT_BANK, hoard: generateHoard(DEFAULT_START_HOARD) });
  saveProfile(p);
  return p;
}

// ── Run launch + commit ──────────────────────────────────────────────────────

/** @type {{ active: true } | null} Marks whether the in-flight run commits back. */
let activeRun = null;

/**
 * Prepare an ephemeral fast-start launch: a freshly generated hoard that is neither
 * drawn from nor committed back to the profile. Clears any active run so the
 * RUN_ENDED commit subscriber no-ops — fast-start sessions are throwaway tests and
 * must not deposit cash or alter the hoard. Always succeeds (no bank/profile
 * dependency), so the player lands in a playable LAN regardless of profile state.
 * @param {number} [_maxCards] - unused; retained for the quickStartRun call signature
 * @returns {{ startHoard: import('../core/types.js').ExploitRound[], startCash: number }}
 */
export function prepareFastStartLaunch(_maxCards) {
  activeRun = null; // a fast-start run does not commit back to the profile
  return { startHoard: generateHoard(DEFAULT_START_HOARD), startCash: 0 };
}

/**
 * Prepare a run launch from the profile: withdraw the carried cash and clone the
 * ENTIRE hoard into the run (no loadout — the whole hoard is carried). Records the
 * active run so it can be committed when it ends. Returns the meta additions
 * (startHoard + startCash) for the caller to merge into the network meta and start
 * via startRun(); returns null if the bank can't cover the carried cash.
 * @param {{ withdrawAmount: number }} args
 * @returns {{ startHoard: import('../core/types.js').ExploitRound[], startCash: number } | null}
 */
export function prepareLaunch({ withdrawAmount }) {
  const profile = loadProfile();
  if (!withdraw(profile, withdrawAmount)) return null;
  saveProfile(profile); // bank debited at launch
  activeRun = { active: true };
  return { startHoard: buildRunHoard(profile.hoard), startCash: withdrawAmount };
}

let _commitWired = false;

/**
 * Reset the commit-wiring guard. TEST-ONLY — call in beforeEach after
 * clearHandlers() so each lifecycle test re-registers the RUN_ENDED handler
 * from a clean state. Never call this in production code.
 */
export function _resetCommitWiringForTest() {
  _commitWired = false;
}

/**
 * Wire the run-end → profile commit (call once at app init). On RUN_ENDED:
 * clean deposits run cash and persists the final carried hoard; caught keeps the
 * hoard unchanged (E1: no loss) and deposits nothing (run cash already forfeit).
 * Reads the final cash/hoard from live game state.
 */
export function initProfileRunCommit() {
  if (_commitWired) return;
  _commitWired = true;
  on(E.RUN_ENDED, ({ outcome }) => {
    if (!activeRun) return;
    const s = getState();
    const profile = loadProfile();
    commitRun(profile, {
      outcome,
      finalCash: s.player.cash, // already 0 on "caught" — endRun zeroes it
      finalHoard: s.player.hoard,
    });
    saveProfile(profile);
    activeRun = null;
  });
}
