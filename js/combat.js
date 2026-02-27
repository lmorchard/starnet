// @ts-check
// Exploit vs vulnerability combat resolution and launch action

/** @typedef {import('./types.js').ExploitCard} ExploitCard */
/** @typedef {import('./types.js').NodeState} NodeState */
/** @typedef {import('./types.js').ExploitResult} ExploitResult */
/** @typedef {import('./types.js').Grade} Grade */

import { getState, ALERT_ORDER, revealNeighbors, emit } from "./state.js";
import { emitEvent, E } from "./events.js";
import { resolveNode } from "./node-types.js";

// Success chance modifier by node security grade
const GRADE_MODIFIER = {
  S: 0.05,
  A: 0.15,
  B: 0.30,
  C: 0.50,
  D: 0.70,
  F: 0.90,
};

// Disclosure chance on failure by grade (higher grade = more likely to detect and disclose)
const DISCLOSURE_CHANCE = {
  S: 0.85,
  A: 0.70,
  B: 0.50,
  C: 0.30,
  D: 0.15,
  F: 0.05,
};

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
 * Resolve an exploit attempt against a node.
 *
 * Returns a result object describing what happened.
 */
export function resolveExploit(exploit, node) {
  const knownVulns = node.vulnerabilities.filter((v) => !v.patched && !v.hidden);
  const matchingVulns = knownVulns.filter((v) =>
    exploit.targetVulnTypes.includes(v.id)
  );

  const resolved = resolveNode(node);
  const gradeModifier    = (resolved.combatConfig?.gradeModifier    ?? GRADE_MODIFIER)[node.grade]    ?? 0.3;
  const disclosureChance = (resolved.combatConfig?.disclosureChance ?? DISCLOSURE_CHANCE)[node.grade] ?? 0.3;

  const matchBonus = matchingVulns.length > 0 ? 0.4 : 0;
  const successChance = Math.min(0.95, exploit.quality * gradeModifier + matchBonus);

  const roll = Math.random();
  const success = roll <= successChance;

  let disclosed = false;
  if (!success) {
    const disclosureRoll = Math.random();
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
  exploit.usesRemaining = Math.max(0, exploit.usesRemaining - 1);
  if (exploit.usesRemaining === 0) {
    exploit.decayState = "disclosed";
  } else if (exploit.usesRemaining === 1 && exploit.decayState === "fresh") {
    exploit.decayState = "worn";
  }

  if (!result.success && result.disclosed) {
    const partialBurn = exploit.usesRemaining > 1 && Math.random() < 0.6;
    if (partialBurn) {
      exploit.usesRemaining--;
      result.partialBurn = true;
    } else {
      exploit.decayState = "disclosed";
    }
  }
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
  const fn = SUCCESS_FLAVORS[Math.floor(Math.random() * SUCCESS_FLAVORS.length)];
  return fn(exploit, vulns);
}

function pickFailFlavor(exploit, disclosed, matchingVulns) {
  if (disclosed) {
    const fn = FAIL_FLAVORS_DETECTED[Math.floor(Math.random() * FAIL_FLAVORS_DETECTED.length)];
    return fn(exploit);
  }
  const pool = matchingVulns.length > 0 ? FAIL_FLAVORS_MATCH : FAIL_FLAVORS_NO_MATCH;
  const fn = pool[Math.floor(Math.random() * pool.length)];
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

  if (node.accessLevel === "owned") {
    emitEvent(E.LOG_ENTRY, { text: `${node.label}: already owned — nothing left to exploit.`, type: "info" });
    emit();
    return null;
  }

  if (exploit.usesRemaining === 0) {
    emitEvent(E.LOG_ENTRY, { text: `${exploit.name}: No uses remaining.`, type: "error" });
    emit();
    return null;
  }

  const result = resolveExploit(exploit, node);
  applyCardDecay(exploit, result);

  if (result.success) {
    result.levelChanged = false;
    const prevAccess = node.accessLevel;

    if (node.accessLevel === "locked") {
      node.accessLevel = "compromised";
      node.alertState = "green";
      node.visibility = "accessible";
      revealNeighbors(nodeId);
      result.levelChanged = true;
    } else if (node.accessLevel === "compromised") {
      node.accessLevel = "owned";
      node.alertState = "green";
      revealNeighbors(nodeId);
      result.levelChanged = true;
    }

    emitEvent(E.EXPLOIT_SUCCESS, {
      nodeId,
      label: node.label,
      exploitName: exploit.name,
      flavor: result.flavor,
      roll: result.roll,
      successChance: result.successChance,
      matchingVulns: result.matchingVulns,
    });

    if (result.levelChanged) {
      emitEvent(E.NODE_ACCESSED, { nodeId, label: node.label, prev: prevAccess, next: node.accessLevel });
    }

    // Reveal staged vulnerabilities unlocked by the exploit's target types
    const usedTypes = exploit.targetVulnTypes;
    node.vulnerabilities.forEach((v) => {
      if (v.hidden && v.unlockedBy && usedTypes.includes(v.unlockedBy)) {
        v.hidden = false;
        emitEvent(E.EXPLOIT_SURFACE, { nodeId, label: node.label });
      }
    });
  } else {
    // Raise node alert on failure
    const prevAlert = node.alertState;
    const idx = ALERT_ORDER.indexOf(node.alertState);
    if (idx < ALERT_ORDER.length - 1) {
      node.alertState = ALERT_ORDER[idx + 1];
    }

    s.lastDisturbedNodeId = nodeId;

    emitEvent(E.EXPLOIT_FAILURE, {
      nodeId,
      label: node.label,
      exploitName: exploit.name,
      flavor: result.flavor,
      roll: result.roll,
      successChance: result.successChance,
      matchingVulns: result.matchingVulns,
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

  emit();
  return result;
}
