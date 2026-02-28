// @ts-check
// Macguffin definitions and assignment

/** @typedef {import('./types.js').Macguffin} Macguffin */
/** @typedef {import('./types.js').NodeState} NodeState */

const MACGUFFIN_TYPES = [
  {
    id: "research-dossier",
    name: "Encrypted Research Dossier",
    description: "Proprietary quantum-lattice compression research, pre-publication draft.",
    cashRange: [400, 1600],
  },
  {
    id: "cryptowallet",
    name: "Corporate Cryptowallet Fragment",
    description: "Partial seed phrase for a high-value Ansible Credits escrow account.",
    cashRange: [1000, 4000],
  },
  {
    id: "credential-dump",
    name: "Auth Credential Dump",
    description: "Hashed password archive from directory server, 847 accounts.",
    cashRange: [200, 800],
  },
  {
    id: "binary-archive",
    name: "Proprietary Binary Archive",
    description: "Compiled firmware images with embedded signing keys — no source included.",
    cashRange: [600, 2000],
  },
  {
    id: "executive-comms",
    name: "Executive Correspondence Bundle",
    description: "Flagged comms between C-suite and off-book subsidiary. Highly compromising.",
    cashRange: [400, 1200],
  },
  {
    id: "zero-day-archive",
    name: "Zero-Day Archive",
    description: "Unpublished exploit collection, attributed to a known threat actor group.",
    cashRange: [1600, 5000],
  },
  {
    id: "biometric-db",
    name: "Biometric Identity Database",
    description: "Neural interface authentication hashes for 12,000 registered users.",
    cashRange: [800, 2400],
  },
  {
    id: "ansible-keys",
    name: "Ansible Relay Access Keys",
    description: "Provisional auth tokens for a private ansible relay node. Expires in 72 hours.",
    cashRange: [1200, 3600],
  },
  {
    id: "financial-records",
    name: "Obfuscated Financial Records",
    description: "Laundered transaction logs through shell corps on three planets.",
    cashRange: [600, 1800],
  },
  {
    id: "ai-weights",
    name: "Contraband AI Model Weights",
    description: "Fine-tuned daemon substrate — provenance unknown, possibly alien artifact.",
    cashRange: [2000, 6000],
  },
];

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateMacguffin() {
  const type = randomFrom(MACGUFFIN_TYPES);
  const value = randomInt(...type.cashRange);
  return {
    id: `${type.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    typeId: type.id,
    name: type.name,
    description: type.description,
    cashValue: value,
    collected: false,
  };
}

// Pick one macguffin at random from all loot nodes, mark it as the mission target,
// and multiply its cash value by 10. Returns { id, name } for state to record.
export function flagMissionMacguffin(nodes) {
  const all = nodes.flatMap((n) => n.macguffins);
  if (all.length === 0) return null;
  const target = randomFrom(all);
  target.isMission = true;
  target.cashValue *= 3;
  return { id: target.id, name: target.name };
}

