// @ts-check
// Generation rules for the corporate biome.
// Absorbs data/node-type-rules.js and adds gradeRole, fixedGrade, labels, minMoneyGrade.
// Pure data — no runtime logic.

import { GRADE_INDEX } from "../../grades.js";

// ── Role map ──────────────────────────────────────────────────────────────────

/** Maps role names to node type strings for the corporate biome. */
export const ROLES = {
  wan:     "wan",
  gateway: "gateway",
  monitor: "security-monitor",
  sensor:  "ids",
  gate:    "firewall",
  routing: "router",
  target:  "fileserver",
  premium: "cryptovault",
  filler:  "workstation",
};

// ── Node rules ────────────────────────────────────────────────────────────────

/**
 * Per-type generation rules.
 *
 * Topology fields (from original node-type-rules.js):
 *   singleton      — at most one of this type per network
 *   depth          — default depth layer (0 = gateway level)
 *   connectsTo     — downstream node types this type connects to
 *   gateType       — node gates neighbor reveal
 *   leaf           — no outgoing connections to content/routing nodes
 *   security       — part of the IDS/monitor security chain
 *   mustBehindGate — must have a gate-type node on the path from gateway
 *   iceResident    — ICE starts here
 *   minCount       — minimum instances in a generated network (0 = optional)
 *   maxCount       — maximum instances in a generated network
 *
 * Generation fields (new):
 *   gradeRole      — how the engine resolves this type's grade:
 *                    "fixed"     → use fixedGrade field (no rng)
 *                    "entry"     → shiftGrade(pathGradeMin, -1) (no rng)
 *                    "soft"      → shiftGrade(pathGradeMin, -1) (no rng)
 *                    "path"      → randomGrade(rng, pathGradeMin, pathGradeMax) (consumes rng)
 *                    "hard"      → pathGradeMax (no rng)
 *                    "above-min" → shiftGrade(pathGradeMin, 1) (no rng)
 *   fixedGrade     — used when gradeRole is "fixed"
 *   minMoneyGrade  — minimum moneyCost grade required to spawn this type (optional nodes)
 *   labels         — pool of display names; shuffled and popped by the engine
 */
export const NODE_RULES = {
  wan: {
    singleton:  true,
    depth:      -1,
    connectsTo: ["gateway"],
    leaf:       false,
    fixedGrade: "D",
    labels:     ["WAN"],
  },

  gateway: {
    singleton:  true,
    depth:      0,
    connectsTo: ["router", "router", "firewall"],
    leaf:       false,
    gradeRole:  "entry",
    labels:     ["INET-GW-01", "INET-GW-02", "GW-MAIN", "GW-EDGE"],
  },

  router: {
    singleton:  false,
    depth:      1,
    connectsTo: ["workstation", "workstation", "fileserver"],
    leaf:       false,
    minCount:   1,
    maxCount:   2,
    gradeRole:  "path",
    labels:     ["RTR-A", "RTR-B", "RTR-CORE", "RTR-EDGE", "RTR-01", "RTR-02"],
  },

  firewall: {
    singleton:  false,
    gateType:   true,
    depth:      1,
    connectsTo: ["fileserver", "cryptovault"],
    leaf:       false,
    minCount:   0,
    maxCount:   1,
    gradeRole:  "hard",
    labels:     ["FW-CORE", "FW-PERIMETER", "FW-DMZ", "FW-01"],
  },

  workstation: {
    singleton:  false,
    depth:      2,
    connectsTo: [],
    leaf:       true,
    minCount:   1,
    maxCount:   3,
    gradeRole:  "soft",
    labels:     ["WS-ALPHA", "WS-BETA", "WS-GAMMA", "WS-DELTA", "WS-01", "WS-02", "WS-03"],
  },

  fileserver: {
    singleton:  false,
    depth:      2,
    connectsTo: [],
    leaf:       true,
    minCount:   1,
    maxCount:   2,
    gradeRole:  "path",
    labels:     ["FS-VAULT", "FS-ARCHIVE", "FS-DATA", "FS-01", "FS-02"],
  },

  cryptovault: {
    singleton:      false,
    mustBehindGate: true,
    depth:          3,
    connectsTo:     [],
    leaf:           true,
    minCount:       0,
    maxCount:       1,
    gradeRole:      "hard",
    minMoneyGrade:  "B",
    labels:         ["CRYPT-X9", "CRYPT-01", "VAULT-S", "VAULT-01"],
  },

  ids: {
    singleton:  false,
    security:   true,
    depth:      2,
    connectsTo: ["security-monitor"],
    leaf:       false,
    minCount:   1,
    maxCount:   1,
    gradeRole:  "above-min",
    labels:     ["IDS-01", "IDS-02", "IDS-EDGE"],
  },

  "security-monitor": {
    singleton:   true,
    security:    true,
    iceResident: true,
    depth:       3,
    connectsTo:  [],
    leaf:        true,
    gradeRole:   "hard",
    labels:      ["SEC-MON", "SEC-MON-01", "MON-CORE"],
  },
};

// ── Layer definitions ─────────────────────────────────────────────────────────

/**
 * Layer definitions encode the corporate LAN topology as behavior atoms.
 * The engine iterates these in order, spawning nodes and wiring edges.
 *
 * Fields:
 *   role           — key into ROLES
 *   count          — number or ({ tc, mc, state }) => number
 *   depth          — number or ({ tc, mc }) => number
 *   gradeRole      — string key for resolveGrade in the engine
 *   connectTo      — role string or ({ tc, mc, state }) => role string | null
 *                    engine calls pick(rng, spawnedByRole[role]) and adds edge TO this node
 *                    (parent → current child direction)
 *   connectsTo     — role string: THIS node adds an edge TO the first node of the role
 *                    (current child → downstream node direction; no rng)
 *   alsoConnectFrom — role string: spawnedByRole[role][0] gets an edge TO this node
 *                    (reverse chain — parent connects to child; fires per-node)
 *   alsoConnectTo  — role string: after all nodes in this layer spawn,
 *                    spawnedByRole[thisRole][0] gets an edge TO spawnedByRole[role][0]
 *                    (forward chain — first of this layer connects to first of target)
 *
 * Layer order is significant: later layers may reference spawnedByRole entries
 * from earlier layers. Order also determines rng() call sequence, which must
 * match the original buildNetwork to preserve snapshot stability.
 */
export const LAYERS = [
  {
    role:      "wan",
    count:     1,
    depth:     -1,
    gradeRole: "fixed",
    connectTo: null,
  },
  {
    role:             "gateway",
    count:            1,
    depth:            0,
    gradeRole:        "entry",
    connectTo:        null,
    alsoConnectFrom:  "wan",           // wan → gateway
  },
  {
    role:      "monitor",
    count:     1,
    depth:     ({ tc }) => tc.depthBudget,
    gradeRole: "hard",
    connectTo: null,
  },
  {
    role:       "sensor",
    count:      1,
    depth:      ({ tc }) => Math.max(1, tc.depthBudget - 1),
    gradeRole:  "above-min",           // no rng
    connectsTo: "monitor",             // sensor → monitor (event-flow direction)
  },
  {
    role:          "routing",
    count:         ({ tc }) => tc.depthBudget >= 3 ? 2 : 1,
    depth:         1,
    gradeRole:     "path",             // consumes rng — matches original order
    connectTo:     "gateway",
    alsoConnectTo: "sensor",           // routing[0] → sensor[0] (after full layer)
  },
  {
    role:      "gate",
    count:     ({ tc }) => tc.gateCount >= 1 ? 1 : 0,
    depth:     1,
    gradeRole: "hard",                 // no rng
    connectTo: "gateway",
  },
  {
    role:      "target",
    count:     1,
    depth:     ({ tc, mc }) => Math.min(mc.targetDepth, tc.depthBudget),
    gradeRole: "path",                 // consumes rng — matches original order
    connectTo: ({ state, mc }) =>
      (state.gate?.length ?? 0) > 0 && mc.targetDepth >= 2 ? "gate" : "routing",
  },
  {
    role:      "premium",
    count:     ({ mc, state }) =>
      (state.gate?.length ?? 0) > 0 && mc.targetDepth >= 3 ? 1 : 0,
    depth:     ({ tc }) => tc.depthBudget,
    gradeRole: "hard",                 // no rng
    connectTo: "gate",
  },
  {
    role:      "filler",
    count:     ({ state }) => state.routing?.length ?? 1,
    depth:     2,
    gradeRole: "soft",                 // no rng; pick(rng, targets) fires in engine
    connectTo: "routing",
  },
];
