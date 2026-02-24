// Macguffin definitions and assignment

const MACGUFFIN_TYPES = [
  {
    id: "research-dossier",
    name: "Encrypted Research Dossier",
    description: "Proprietary quantum-lattice compression research, pre-publication draft.",
    cashRange: [2000, 8000],
  },
  {
    id: "cryptowallet",
    name: "Corporate Cryptowallet Fragment",
    description: "Partial seed phrase for a high-value Ansible Credits escrow account.",
    cashRange: [5000, 20000],
  },
  {
    id: "credential-dump",
    name: "Auth Credential Dump",
    description: "Hashed password archive from directory server, 847 accounts.",
    cashRange: [1000, 4000],
  },
  {
    id: "binary-archive",
    name: "Proprietary Binary Archive",
    description: "Compiled firmware images with embedded signing keys — no source included.",
    cashRange: [3000, 10000],
  },
  {
    id: "executive-comms",
    name: "Executive Correspondence Bundle",
    description: "Flagged comms between C-suite and off-book subsidiary. Highly compromising.",
    cashRange: [2000, 6000],
  },
  {
    id: "zero-day-archive",
    name: "Zero-Day Archive",
    description: "Unpublished exploit collection, attributed to a known threat actor group.",
    cashRange: [8000, 25000],
  },
  {
    id: "biometric-db",
    name: "Biometric Identity Database",
    description: "Neural interface authentication hashes for 12,000 registered users.",
    cashRange: [4000, 12000],
  },
  {
    id: "ansible-keys",
    name: "Ansible Relay Access Keys",
    description: "Provisional auth tokens for a private ansible relay node. Expires in 72 hours.",
    cashRange: [6000, 18000],
  },
  {
    id: "financial-records",
    name: "Obfuscated Financial Records",
    description: "Laundered transaction logs through shell corps on three planets.",
    cashRange: [3000, 9000],
  },
  {
    id: "ai-weights",
    name: "Contraband AI Model Weights",
    description: "Fine-tuned daemon substrate — provenance unknown, possibly alien artifact.",
    cashRange: [10000, 30000],
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

// Which node types can hold macguffins, and how many
const LOOT_CONFIG = {
  fileserver:   { count: [1, 2] },
  cryptovault:  { count: [1, 3] },
  workstation:  { count: [0, 1] },
};

export function assignMacguffins(nodes) {
  nodes.forEach((node) => {
    const config = LOOT_CONFIG[node.type];
    if (!config) return;
    const [min, max] = config.count;
    const count = min + Math.floor(Math.random() * (max - min + 1));
    for (let i = 0; i < count; i++) {
      node.macguffins.push(generateMacguffin());
    }
  });
}
