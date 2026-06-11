// @ts-check
// Exploit vs vulnerability combat resolution and launch action

/** @typedef {import('./types.js').ExploitCard} ExploitCard */
/** @typedef {import('./types.js').NodeState} NodeState */
/** @typedef {import('./types.js').ExploitResult} ExploitResult */
/** @typedef {import('./types.js').Grade} Grade */

import { getState, ALERT_ORDER, revealNeighbors } from "./state.js";
import { RNG, random, randomPick } from "./rng.js";
import {
  setNodeAccessLevel, setNodeAlertState, setNodeVisible, setNodeVulnHidden, setNodeProbed,
} from "./state/node.js";
import { setLastDisturbedNode } from "./state/ice.js";
import { applyCardDecay as applyCardDecayState } from "./state/player.js";
import { emitEvent, E } from "./events.js";
import { A } from "./action-ids.js";

// Success chance modifier by node security grade
export const GRADE_MODIFIER = {
  S: 0.05,
  A: 0.15,
  B: 0.30,
  C: 0.50,
  D: 0.70,
  F: 0.90,
};

/** Flat bonus when exploit targets a known vulnerability on the node. */
export const MATCH_BONUS = 0.4;

/** Hard cap on exploit success probability. */
export const SUCCESS_CAP = 0.95;

// Disclosure chance on failure by grade (higher grade = more likely to detect and disclose)
const DISCLOSURE_CHANCE = {
  S: 0.85,
  A: 0.70,
  B: 0.50,
  C: 0.30,
  D: 0.15,
  F: 0.05,
};

// Skip-to-owned floor and quality scaling. The chance a successful exploit
// jumps locked → owned in one shot is driven by card QUALITY, not rarity:
//   0.08 + quality * 0.55
// This lifts the floor across the board (a fresh common skips ~19–38% of the
// time, up from the old ~2–6%) while still rewarding the best cards most —
// rare cards skip more only because they carry higher quality, not because of
// a separate multiplier. Tops out near 0.60 for a best-in-class rare (q≈0.95);
// never approaches certainty.
const SKIP_TO_OWNED_FLOOR = 0.08;
const SKIP_TO_OWNED_QUALITY_SCALE = 0.55;

/**
 * Chance that a successful exploit jumps from locked directly to owned,
 * skipping the compromised step. Driven by exploit quality.
 * @param {ExploitCard} exploit
 * @returns {number} probability 0-1
 */
export function skipToOwnedChance(exploit) {
  return SKIP_TO_OWNED_FLOOR + exploit.quality * SKIP_TO_OWNED_QUALITY_SCALE;
}

// Patch lag in turns by grade (how quickly vulns get patched after disclosure)
export const PATCH_LAG = {
  S: 1,
  A: 2,
  B: 3,
  C: 4,
  D: 6,
  F: 8,
};

/**
 * RNG.COMBAT roll consumption per launchExploit() code path.
 *
 * The roll ORDER and COUNT matter for any test that uses `_forceNext(RNG.COMBAT, …)`
 * to drive a deterministic outcome — queued forced values are consumed in this order,
 * and any path-specific roll that isn't forced falls through to the seeded sequence.
 * Forcing too few rolls is silently flaky: the unforced roll varies per seed.
 *
 *   resolveExploit():
 *     1. success roll                                  (always)
 *     2a. success → success-flavor pick                (on success)
 *     2b. failure → disclosure roll                    (on failure)
 *         + fail-flavor pick                           (on failure)
 *   launchExploit() / applyCardDecay():
 *     3. skip-to-owned roll                            (success FROM "locked" only)
 *     4. partial-burn roll                             (detected failure, uses > 1)
 *
 * So "force a successful exploit from a locked node" needs THREE forced rolls:
 *   success (low), flavor pick (any), skip-to-owned (high → stay at "compromised").
 * Forcing only the first two leaves the skip roll seeded — see issue #109.
 * Tests MUST pass an explicit seed to initGame() so any unforced roll is at least
 * deterministic rather than Math.random()-derived.
 */

/**
 * Resolve an exploit attempt against a node.
 *
 * Returns a result object describing what happened.
 */
export function resolveExploit(exploit, node) {
  const knownVulns = node.vulnerabilities.filter((v) => !v.patched && !v.hidden);
  const matchingVulns = knownVulns.filter((v) =>
    exploit.targetVulnTypes.includes(v.id)
  );

  const gradeModifier    = GRADE_MODIFIER[node.grade]    ?? 0.3;
  const disclosureChance = DISCLOSURE_CHANCE[node.grade] ?? 0.3;

  const matchBonus = matchingVulns.length > 0 ? MATCH_BONUS : 0;
  const successChance = Math.min(SUCCESS_CAP, exploit.quality * gradeModifier + matchBonus);

  const roll = random(RNG.COMBAT);
  const success = roll <= successChance;

  let disclosed = false;
  if (!success) {
    const disclosureRoll = random(RNG.COMBAT);
    disclosed = disclosureRoll <= disclosureChance;
  }

  return {
    success,
    disclosed,
    successChance: Math.round(successChance * 100),
    roll: Math.round(roll * 100),
    matchingVulns,
    flavor: success ? pickSuccessFlavor(exploit, matchingVulns) : pickFailFlavor(exploit, disclosed, matchingVulns),
  };
}

/**
 * Apply card decay after an exploit attempt.
 * Consumes one use, transitions decay state, and handles partial burn / full
 * disclose on detected failures. Mutates both exploit and result in place.
 */
export function applyCardDecay(exploit, result) {
  let usesRemaining = Math.max(0, exploit.usesRemaining - 1);
  let decayState = exploit.decayState;

  if (usesRemaining === 0) {
    decayState = "disclosed";
  } else if (usesRemaining === 1 && decayState === "fresh") {
    decayState = "worn";
  }

  if (!result.success && result.disclosed) {
    const partialBurn = usesRemaining > 1 && random(RNG.COMBAT) < 0.6;
    if (partialBurn) {
      usesRemaining--;
      result.partialBurn = true;
    } else {
      decayState = "disclosed";
    }
  }

  // Apply through the state mutation system
  applyCardDecayState(exploit.id, usesRemaining, /** @type {import('./types.js').DecayState} */ (decayState));
}

// ── Flavor text ───────────────────────────────────────────

const SUCCESS_FLAVORS = [
  (exploit, vulns) =>
    vulns.length > 0
      ? `${exploit.name} exploited ${vulns[0].name}. Access granted.`
      : `${exploit.name} found an unexpected opening. Partial access acquired.`,
  (exploit) => `Payload delivered. ${exploit.name} executed cleanly.`,
  (exploit) => `${exploit.name} bypassed authentication. Shell established.`,
  () => `Exploit chain succeeded. Privilege level elevated.`,
];

// Detected failure messages (exploit was logged/burned)
const FAIL_FLAVORS_DETECTED = [
  (exploit) => `${exploit.name} triggered an IDS signature. Exploit characteristics logged.`,
  () => `Connection fingerprinted. Exploit pattern recorded by blue team.`,
  (exploit) => `Attack signature captured. ${exploit.name} is now burned.`,
];

// Silent failure messages (failed without detection — split by whether a vuln matched)
const FAIL_FLAVORS_MATCH = [
  (exploit) => `${exploit.name}: access denied — hardened target.`,
  () => `Authentication challenge failed.`,
  () => `Intrusion attempt blocked.`,
  (exploit) => `${exploit.name}: exploit ineffective against current defenses.`,
];

const FAIL_FLAVORS_NO_MATCH = [
  (exploit) => `${exploit.name}: no matching attack surface found.`,
  (exploit) => `${exploit.name}: target not vulnerable to this approach.`,
  () => `Intrusion attempt blocked.`,
];

function pickSuccessFlavor(exploit, vulns) {
  const fn = randomPick(RNG.COMBAT, SUCCESS_FLAVORS);
  return fn(exploit, vulns);
}

function pickFailFlavor(exploit, disclosed, matchingVulns) {
  if (disclosed) {
    const fn = randomPick(RNG.COMBAT, FAIL_FLAVORS_DETECTED);
    return fn(exploit);
  }
  const pool = matchingVulns.length > 0 ? FAIL_FLAVORS_MATCH : FAIL_FLAVORS_NO_MATCH;
  const fn = randomPick(RNG.COMBAT, pool);
  return fn(exploit);
}

// ── Launch action ─────────────────────────────────────────

/**
 * Launch an exploit card against a node.
 * Resolves combat, applies card decay, mutates access/alert state, and emits events.
 * @returns {ExploitResult|null}
 */
export function launchExploit(nodeId, exploitId) {
  const s = getState();
  const node = s.nodes[nodeId];
  const exploit = s.player.hand.find((c) => c.id === exploitId);
  if (!node || !exploit || exploit.decayState === "disclosed") return null;

  if (exploit.usesRemaining === 0) {
    emitEvent(E.LOG_ENTRY, { text: `${exploit.name}: No uses remaining.`, type: "error" });
    return null;
  }

  const result = resolveExploit(exploit, node);
  applyCardDecay(exploit, result);

  if (result.success) {
    result.levelChanged = false;
    const prevAccess = node.accessLevel;

    if (node.accessLevel === "locked") {
      // High-quality/rare exploits can skip compromised → owned in one shot
      const skipChance = skipToOwnedChance(exploit);
      const skipRoll = random(RNG.COMBAT);
      if (skipRoll <= skipChance) {
        setNodeAccessLevel(nodeId, "owned");
        setNodeAlertState(nodeId, "green");
        setNodeVisible(nodeId, "accessible");
        revealNeighbors(nodeId);
        result.levelChanged = true;
        result.skippedToOwned = true;
      } else {
        setNodeAccessLevel(nodeId, "compromised");
        setNodeAlertState(nodeId, "green");
        setNodeVisible(nodeId, "accessible");
        if ((node.gateAccess ?? "probed") !== "owned") revealNeighbors(nodeId);
        result.levelChanged = true;
      }
    } else if (node.accessLevel === "compromised") {
      setNodeAccessLevel(nodeId, "owned");
      setNodeAlertState(nodeId, "green");
      revealNeighbors(nodeId);
      result.levelChanged = true;
    }

    // A successful exploit means you're inside — treat the node as probed (reveals vulns
    // and engages the picker's match filter), so a blind gamble that lands also counts
    // as a probe. Idempotent if the node was already probed.
    setNodeProbed(nodeId);

    // A clean exploit: clear the disturbance so ICE doesn't chase a ghost signal.
    setLastDisturbedNode(null);

    emitEvent(E.ACTION_RESOLVED, {
      action: A.XPLOIT, nodeId, label: node.label, success: true,
      detail: { exploitName: exploit.name, flavor: result.flavor, roll: result.roll,
        successChance: result.successChance, matchingVulns: result.matchingVulns },
    });

    if (result.levelChanged) {
      emitEvent(E.NODE_ACCESSED, { nodeId, label: node.label, prev: prevAccess, next: node.accessLevel });
    }

    // Reveal staged vulnerabilities unlocked by the exploit's target types
    const usedTypes = exploit.targetVulnTypes;
    node.vulnerabilities.forEach((v, idx) => {
      if (v.hidden && v.unlockedBy && usedTypes.includes(v.unlockedBy)) {
        setNodeVulnHidden(nodeId, idx, false);
        emitEvent(E.EXPLOIT_SURFACE, { nodeId, label: node.label });
      }
    });
  } else {
    // Raise node alert on failure
    const prevAlert = node.alertState;
    const idx = ALERT_ORDER.indexOf(node.alertState);
    if (idx < ALERT_ORDER.length - 1) {
      setNodeAlertState(nodeId, ALERT_ORDER[idx + 1]);
    }

    setLastDisturbedNode(nodeId);

    emitEvent(E.ACTION_RESOLVED, {
      action: A.XPLOIT, nodeId, label: node.label, success: false,
      detail: { exploitName: exploit.name, flavor: result.flavor, roll: result.roll,
        successChance: result.successChance, matchingVulns: result.matchingVulns },
    });

    if (node.alertState !== prevAlert) {
      emitEvent(E.NODE_ALERT_RAISED, { nodeId, label: node.label, prev: prevAlert, next: node.alertState });
    }

    if (result.disclosed && !result.partialBurn) {
      emitEvent(E.EXPLOIT_DISCLOSED, { exploitName: exploit.name });
    } else if (result.partialBurn) {
      emitEvent(E.EXPLOIT_PARTIAL_BURN, { exploitName: exploit.name, usesRemaining: exploit.usesRemaining });
    }
  }

  return result;
}
