// @ts-check
// Exploit vs vulnerability combat resolution

/** @typedef {import('./types.js').ExploitCard} ExploitCard */
/** @typedef {import('./types.js').NodeState} NodeState */
/** @typedef {import('./types.js').ExploitResult} ExploitResult */
/** @typedef {import('./types.js').Grade} Grade */

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

  const gradeModifier = GRADE_MODIFIER[node.grade] ?? 0.3;
  const matchBonus = matchingVulns.length > 0 ? 0.4 : 0;
  const successChance = Math.min(0.95, exploit.quality * gradeModifier + matchBonus);

  const roll = Math.random();
  const success = roll <= successChance;

  let disclosed = false;
  if (!success) {
    const disclosureRoll = Math.random();
    disclosed = disclosureRoll <= (DISCLOSURE_CHANCE[node.grade] ?? 0.3);
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
  if (exploit.usesRemaining === 0 && exploit.decayState === "fresh") {
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
