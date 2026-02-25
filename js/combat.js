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
  const matchBonus = matchingVulns.length > 0 ? 0.2 : 0;
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
    flavor: success ? pickSuccessFlavor(exploit, matchingVulns) : pickFailFlavor(exploit, disclosed),
  };
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

const FAIL_FLAVORS = [
  (exploit, disclosed) =>
    disclosed
      ? `${exploit.name} triggered an IDS signature. Exploit characteristics logged.`
      : `${exploit.name} failed — target patched or not vulnerable.`,
  (_, disclosed) =>
    disclosed
      ? `Connection fingerprinted. Exploit pattern recorded by blue team.`
      : `Exploit rejected. No matching attack surface found.`,
  () => `Intrusion attempt detected and blocked.`,
  (_, disclosed) =>
    disclosed ? `Attack signature captured. This exploit is now burned.` : `Access denied.`,
];

function pickSuccessFlavor(exploit, vulns) {
  const fn = SUCCESS_FLAVORS[Math.floor(Math.random() * SUCCESS_FLAVORS.length)];
  return fn(exploit, vulns);
}

function pickFailFlavor(exploit, disclosed) {
  const fn = FAIL_FLAVORS[Math.floor(Math.random() * FAIL_FLAVORS.length)];
  return fn(exploit, disclosed);
}
