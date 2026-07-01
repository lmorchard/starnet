// @ts-check
// Exploit vs vulnerability combat resolution and launch action

/** @typedef {import('./types.js').ExploitCard} ExploitCard */
/** @typedef {import('./types.js').NodeState} NodeState */
/** @typedef {import('./types.js').ExploitResult} ExploitResult */
/** @typedef {import('./types.js').Grade} Grade */

import { getState, nextAlertLevel, revealNeighbors } from "./state.js";
import { RNG, random, randomPick } from "./rng.js";
import {
  setNodeAccessLevel, setNodeAlertState, setNodeVisible, setNodeVulnHidden, setNodeProbed,
} from "./state/node.js";
import { setLastDisturbedNode } from "./state/ice.js";
import { applyCardDecay as applyCardDecayState } from "./state/player.js";
import { emitEvent, E } from "./events.js";
import { A } from "./action-ids.js";
import { recordHeat } from "./alert.js";
import {
  GRADE_MODIFIER, MATCH_BONUS, SUCCESS_CAP, DISCLOSURE_CHANCE,
  SKIP_TO_OWNED_FLOOR, SKIP_TO_OWNED_QUALITY_SCALE, PATCH_LAG, HEAT_COST,
} from "./balance.js";

// Re-export combat-balance constants so existing `import … from "./combat.js"`
// sites keep working; the values now live in balance.js (#169).
export { GRADE_MODIFIER, MATCH_BONUS, SUCCESS_CAP, PATCH_LAG };

/**
 * Chance that a successful exploit jumps from locked directly to owned,
 * skipping the open step. Driven by exploit quality.
 * @param {ExploitCard} exploit
 * @returns {number} probability 0-1
 */
export function skipToOwnedChance(exploit) {
  return SKIP_TO_OWNED_FLOOR + exploit.quality * SKIP_TO_OWNED_QUALITY_SCALE;
}

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
 *   success (low), flavor pick (any), skip-to-owned (high → stay at "open").
 * Forcing only the first two leaves the skip roll seeded — see issue #109.
 * Tests MUST pass an explicit seed to initGame() so any unforced roll is at least
 * deterministic rather than Math.random()-derived.
 */

/**
 * Resolve an exploit attempt against a node — the pure combat roll only.
 *
 * Returns a result object describing what happened (success, flavor, rolls).
 * @param {ExploitCard} exploit
 * @param {NodeState} node
 * @returns {ExploitResult}
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
 * Resolve an exploit launch into a complete, side-effect-free PLAN: the combat
 * roll (resolveExploit) plus the decided access-level transition, alert raise, and
 * staged-vuln surfacing. Consumes RNG — success, flavor/disclosure, and (on a
 * successful exploit FROM "locked") the skip-to-owned roll — but performs NO state
 * mutation or event emission; applyCombatResult does that. Pure given the RNG
 * stream + node reads, so the resolution logic is unit-testable without side
 * effects (#168).
 *
 * The skip roll moves ahead of applyCardDecay's partial-burn roll, but the two are
 * on mutually exclusive paths (success vs detected failure), so the RNG.COMBAT
 * sequence per path is unchanged (see the roll-consumption note above).
 * @param {ExploitCard} exploit
 * @param {NodeState} node
 * @returns {ExploitResult}
 */
export function resolveCombat(exploit, node) {
  const result = resolveExploit(exploit, node);

  if (result.success) {
    result.levelChanged = false;
    result.prevAccess = node.accessLevel;

    if (node.accessLevel === "locked") {
      // High-quality/rare exploits can skip open → owned in one shot
      const skipRoll = random(RNG.COMBAT);
      if (skipRoll <= skipToOwnedChance(exploit)) {
        result.nextAccess = "owned";
        result.skippedToOwned = true;
        result.revealNeighbors = true;
      } else {
        result.nextAccess = "open";
        result.revealNeighbors = (node.gateAccess ?? "probed") !== "owned";
      }
      result.levelChanged = true;
    } else if (node.accessLevel === "open") {
      result.nextAccess = "owned";
      result.revealNeighbors = true;
      result.levelChanged = true;
    }

    // Staged vulnerabilities the used exploit's target types unlock — surfaced on apply.
    const usedTypes = exploit.targetVulnTypes;
    result.vulnsToSurface = [];
    node.vulnerabilities.forEach((v, idx) => {
      if (v.hidden && v.unlockedBy && usedTypes.includes(v.unlockedBy)) {
        result.vulnsToSurface.push(idx);
      }
    });
  } else {
    result.prevAlert = node.alertState;
    result.nextAlert = nextAlertLevel(node.alertState);
  }

  return result;
}

/**
 * Apply a resolved combat plan to game state: mutate access / alert / probed /
 * disturbance, surface staged vulns, and emit ACTION_RESOLVED / NODE_ACCESSED /
 * NODE_ALERT_RAISED / EXPLOIT_* events. All RNG was consumed in resolveCombat;
 * applyCardDecay (which sets result.partialBurn) must run before this.
 * @param {string} nodeId
 * @param {ExploitCard} exploit
 * @param {ExploitResult} result
 */
export function applyCombatResult(nodeId, exploit, result) {
  const node = getState().nodes[nodeId];
  recordHeat(HEAT_COST.xploit); // every xploit attempt is activity — raises heat (success or fail)
  const detail = { exploitName: exploit.name, flavor: result.flavor, roll: result.roll,
    successChance: result.successChance, matchingVulns: result.matchingVulns };

  if (result.success) {
    if (result.nextAccess) {
      setNodeAccessLevel(nodeId, result.nextAccess);
      setNodeAlertState(nodeId, "green");
      // Transitions FROM locked also reveal the node itself.
      if (result.prevAccess === "locked") setNodeVisible(nodeId, "accessible");
      if (result.revealNeighbors) revealNeighbors(nodeId);
    }

    // A successful exploit means you're inside — treat the node as probed (reveals vulns
    // and engages the picker's match filter), so a blind gamble that lands also counts
    // as a probe. Idempotent if the node was already probed.
    setNodeProbed(nodeId);

    // A clean exploit: clear the disturbance so ICE doesn't chase a ghost signal.
    setLastDisturbedNode(null);

    emitEvent(E.ACTION_RESOLVED, { action: A.XPLOIT, nodeId, label: node.label, success: true, detail });

    if (result.levelChanged) {
      emitEvent(E.NODE_ACCESSED, { nodeId, label: node.label, prev: result.prevAccess, next: node.accessLevel });
    }

    // Reveal staged vulnerabilities unlocked by the exploit's target types
    (result.vulnsToSurface ?? []).forEach((idx) => {
      setNodeVulnHidden(nodeId, idx, false);
      emitEvent(E.EXPLOIT_SURFACE, { nodeId, label: node.label });
    });
  } else {
    // Raise node alert on failure
    if (result.nextAlert !== result.prevAlert) {
      setNodeAlertState(nodeId, /** @type {import('./types.js').NodeAlertLevel} */ (result.nextAlert));
    }

    setLastDisturbedNode(nodeId);

    emitEvent(E.ACTION_RESOLVED, { action: A.XPLOIT, nodeId, label: node.label, success: false, detail });

    if (result.nextAlert !== result.prevAlert) {
      emitEvent(E.NODE_ALERT_RAISED, { nodeId, label: node.label, prev: result.prevAlert, next: result.nextAlert });
    }

    if (result.disclosed && !result.partialBurn) {
      emitEvent(E.EXPLOIT_DISCLOSED, { exploitName: exploit.name });
    } else if (result.partialBurn) {
      emitEvent(E.EXPLOIT_PARTIAL_BURN, { exploitName: exploit.name, usesRemaining: exploit.usesRemaining });
    }
  }
}

/**
 * Launch an exploit card against a node. Orchestrates the pure resolution
 * (resolveCombat) → card decay → state mutation + events (applyCombatResult).
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

  const result = resolveCombat(exploit, node);
  applyCardDecay(exploit, result);
  applyCombatResult(nodeId, exploit, result);

  return result;
}
