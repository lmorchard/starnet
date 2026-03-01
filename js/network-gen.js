// @ts-check
// Procedural LAN generator.
// generateNetwork(seed, timeCost, moneyCost) → NETWORK-shaped object.
//
// Self-contained: uses its own local Mulberry32 RNG seeded from the seed string.
// Does NOT depend on js/rng.js so it doesn't affect gameplay randomness.

import { GRADES, GRADE_INDEX, parseGrade, shiftGrade, randomGrade, clampGrade } from "./grades.js";
import { SET_PIECES, applySetPiece } from "./set-pieces.js";

// ── Local RNG ─────────────────────────────────────────────────────────────────

/** djb2 string hash → signed int32. */
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Create a self-contained Mulberry32 RNG returning [0,1) floats. */
function makeMulberry32(seed32) {
  let s = seed32 | 0;
  return function rng() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random element from an array. */
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Pick and remove a random element from an array (mutates). */
function pickRemove(rng, arr) {
  const i = Math.floor(rng() * arr.length);
  return arr.splice(i, 1)[0];
}

// ── Budget tables ─────────────────────────────────────────────────────────────

/** timeCost grade → ICE grade, network depth budget, gate count. */
const TIME_BUDGET = {
  F: { iceGrade: "F", depthBudget: 2, gateCount: 0 },
  D: { iceGrade: "D", depthBudget: 2, gateCount: 1 },
  C: { iceGrade: "C", depthBudget: 3, gateCount: 1 },
  B: { iceGrade: "B", depthBudget: 3, gateCount: 2 },
  A: { iceGrade: "A", depthBudget: 4, gateCount: 2 },
  S: { iceGrade: "S", depthBudget: 5, gateCount: 3 },
};

/** moneyCost grade → grade range for critical path nodes, target depth. */
const MONEY_BUDGET = {
  F: { pathGradeMin: "F", pathGradeMax: "D", targetDepth: 1 },
  D: { pathGradeMin: "F", pathGradeMax: "C", targetDepth: 1 },
  C: { pathGradeMin: "D", pathGradeMax: "B", targetDepth: 2 },
  B: { pathGradeMin: "C", pathGradeMax: "A", targetDepth: 3 },
  A: { pathGradeMin: "B", pathGradeMax: "S", targetDepth: 3 },
  S: { pathGradeMin: "A", pathGradeMax: "S", targetDepth: 4 },
};

// ── Label pools ───────────────────────────────────────────────────────────────

const LABEL_POOLS = {
  wan:                ["WAN"],
  gateway:            ["INET-GW-01", "INET-GW-02", "GW-MAIN", "GW-EDGE"],
  router:             ["RTR-A", "RTR-B", "RTR-CORE", "RTR-EDGE", "RTR-01", "RTR-02"],
  firewall:           ["FW-CORE", "FW-PERIMETER", "FW-DMZ", "FW-01"],
  workstation:        ["WS-ALPHA", "WS-BETA", "WS-GAMMA", "WS-DELTA", "WS-01", "WS-02", "WS-03"],
  fileserver:         ["FS-VAULT", "FS-ARCHIVE", "FS-DATA", "FS-01", "FS-02"],
  cryptovault:        ["CRYPT-X9", "CRYPT-01", "VAULT-S", "VAULT-01"],
  ids:                ["IDS-01", "IDS-02", "IDS-EDGE"],
  "security-monitor": ["SEC-MON", "SEC-MON-01", "MON-CORE"],
};

// ── Layout ────────────────────────────────────────────────────────────────────

const LAYOUT_CENTER_X = 400;
const LAYOUT_LAYER_HEIGHT = 140;
const LAYOUT_NODE_SPACING = 200;
const LAYOUT_DEPTH_OFFSET_Y = 50; // y for depth 0

/** Compute x,y positions for a set of nodes, grouped by depth layer. */
function assignPositions(nodes) {
  /** @type {Map<number, string[]>} depth → nodeIds */
  const layers = new Map();
  for (const node of nodes) {
    const d = node._depth ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d).push(node.id);
  }

  /** @type {Map<string, {x:number, y:number}>} */
  const positions = new Map();
  for (const [depth, ids] of layers) {
    const y = LAYOUT_DEPTH_OFFSET_Y + depth * LAYOUT_LAYER_HEIGHT;
    const totalWidth = (ids.length - 1) * LAYOUT_NODE_SPACING;
    ids.forEach((id, i) => {
      positions.set(id, {
        x: LAYOUT_CENTER_X - totalWidth / 2 + i * LAYOUT_NODE_SPACING,
        y,
      });
    });
  }
  return positions;
}

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Generate a NETWORK-shaped object from seed + difficulty parameters.
 *
 * @param {string} seed
 * @param {string} timeCost  - grade letter S/A/B/C/D/F
 * @param {string} moneyCost - grade letter S/A/B/C/D/F
 * @returns {object} NETWORK-compatible object
 */
export function generateNetwork(seed, timeCost, moneyCost) {
  const tc = parseGrade(timeCost);
  const mc = parseGrade(moneyCost);
  if (!tc) throw new Error(`generateNetwork: invalid timeCost "${timeCost}"`);
  if (!mc) throw new Error(`generateNetwork: invalid moneyCost "${moneyCost}"`);

  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Each attempt gets a fresh RNG derived from seed + attempt index.
    const rng = makeMulberry32(djb2(`${seed}-network-${attempt}`));
    const candidate = buildNetwork(rng, tc, mc);
    const failure = validate(candidate);
    if (!failure) return candidate;
    if (attempt === MAX_ATTEMPTS - 1) {
      throw new Error(`generateNetwork: failed after ${MAX_ATTEMPTS} attempts. Last failure: ${failure}`);
    }
  }
  // Unreachable, but satisfies type checker
  throw new Error("generateNetwork: unexpected exit");
}

/** Build one candidate network. May produce an invalid result — caller validates. */
function buildNetwork(rng, tc, mc) {
  const time   = TIME_BUDGET[tc];
  const money  = MONEY_BUDGET[mc];

  // Label pools — shuffled copies so we pick without repeating
  /** @type {Record<string, string[]>} */
  const labelPools = {};
  for (const [type, labels] of Object.entries(LABEL_POOLS)) {
    labelPools[type] = [...labels];
    shuffle(rng, labelPools[type]);
  }

  function nextLabel(type) {
    const pool = labelPools[type];
    if (!pool || pool.length === 0) {
      // Fallback: numbered label
      return `${type.toUpperCase()}-X`;
    }
    return pool.pop();
  }

  // ── Node and edge accumulators ──────────────────────────────────────────────
  /** @type {Array<{id:string, type:string, label:string, grade:string, _depth:number}>} */
  const nodes = [];
  /** @type {Array<{source:string, target:string}>} */
  const edges = [];
  let nodeSeq = 0;
  function makeId(type) { return `${type}-${++nodeSeq}`; }

  function addNode(type, grade, depth) {
    const id = makeId(type);
    nodes.push({ id, type, label: nextLabel(type), grade, _depth: depth });
    return id;
  }

  function addEdge(source, target) {
    edges.push({ source, target });
  }

  // ── Grade helpers ───────────────────────────────────────────────────────────
  const { pathGradeMin, pathGradeMax } = money;

  function entryGrade()  { return shiftGrade(pathGradeMin, -1); }
  function softGrade()   { return shiftGrade(pathGradeMin, -1); }
  function pathGrade()   { return randomGrade(rng, pathGradeMin, pathGradeMax); }
  function hardGrade()   { return shiftGrade(pathGradeMax, 0); }

  // ── Fixed anchors ───────────────────────────────────────────────────────────
  const wanId     = addNode("wan",              "D",          -1);
  const gatewayId = addNode("gateway",          entryGrade(), 0);
  const monitorId = addNode("security-monitor", hardGrade(),  time.depthBudget);

  addEdge(wanId, gatewayId);

  // ── Security chain ──────────────────────────────────────────────────────────
  // ids attaches to a router (added below); for now record it and wire later
  const idsDepth = Math.max(1, time.depthBudget - 1);
  const idsId    = addNode("ids", shiftGrade(pathGradeMin, 1), idsDepth);
  addEdge(idsId, monitorId);

  // ── Routing layer ───────────────────────────────────────────────────────────
  // Number of routers: 1 for shallow networks, 2 for deeper ones
  const routerCount = time.depthBudget >= 3 ? 2 : 1;
  const routerIds = [];
  for (let i = 0; i < routerCount; i++) {
    const rid = addNode("router", pathGrade(), 1);
    routerIds.push(rid);
    addEdge(gatewayId, rid);
  }

  // Wire IDS to first router
  addEdge(routerIds[0], idsId);

  // ── Gate node(s) ────────────────────────────────────────────────────────────
  let firewallId = null;
  if (time.gateCount >= 1) {
    firewallId = addNode("firewall", hardGrade(), 1);
    addEdge(gatewayId, firewallId);
  }

  // ── Mission target (fileserver) ─────────────────────────────────────────────
  // Depth: clamp targetDepth to available depth budget
  const fsDepth = Math.min(money.targetDepth, time.depthBudget);
  const fsGrade = pathGrade();
  const fileserverId = addNode("fileserver", fsGrade, fsDepth);

  // Connect fileserver: through firewall if available and deep enough, else through router
  if (firewallId && fsDepth >= 2) {
    addEdge(firewallId, fileserverId);
  } else {
    addEdge(pick(rng, routerIds), fileserverId);
  }

  // ── Cryptovault (optional — high difficulty only) ───────────────────────────
  if (firewallId && GRADE_INDEX[mc] >= GRADE_INDEX["B"]) {
    const cvId = addNode("cryptovault", hardGrade(), time.depthBudget);
    addEdge(firewallId, cvId);
  }

  // ── Filler workstations ──────────────────────────────────────────────────────
  const wsCount = routerCount === 1 ? 1 : 2;
  for (let i = 0; i < wsCount; i++) {
    const wsId = addNode("workstation", softGrade(), 2);
    addEdge(pick(rng, routerIds), wsId);
  }

  // ── Set piece (optional) ────────────────────────────────────────────────────
  // careless-user: eligible when moneyCost ≥ C and there's a firewall in the network
  if (GRADE_INDEX[mc] >= GRADE_INDEX["C"] && firewallId && rng() < 0.6) {
    const baseGrade = pathGrade();
    applySetPiece(
      SET_PIECES["careless-user"],
      { nodes, edges },
      rng,
      baseGrade,
      nextLabel,
      makeId,
    );
  }

  // ── Assign x,y positions ────────────────────────────────────────────────────
  const positions = assignPositions(nodes);

  // ── Build final node array (strip internal _depth field) ────────────────────
  const finalNodes = nodes.map(({ id, type, label, grade, _depth }) => {
    const pos = positions.get(id) ?? { x: 400, y: 400 };
    void _depth; // used only for layout
    return { id, type, label, grade, x: pos.x, y: pos.y };
  });

  return {
    nodes: finalNodes,
    edges,
    startNode: gatewayId,
    ice: {
      grade:     time.iceGrade,
      startNode: monitorId,
    },
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (mutates). */
function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Validators ────────────────────────────────────────────────────────────────

/** Run all structural validators. Returns null on pass, or a failure description. */
function validate(network) {
  for (const predicate of VALIDATORS) {
    const result = predicate(network);
    if (result) return result;
  }
  return null;
}

/** Build an adjacency map from edge list. */
function buildAdjacency(network) {
  /** @type {Record<string, string[]>} */
  const adj = {};
  for (const { source, target } of network.edges) {
    (adj[source] ??= []).push(target);
    (adj[target] ??= []).push(source);
  }
  return adj;
}

const VALIDATORS = [
  /** wan, gateway, security-monitor all present. */
  function hasAnchors(network) {
    const types = new Set(network.nodes.map((n) => n.type));
    if (!types.has("wan"))              return "missing wan node";
    if (!types.has("gateway"))          return "missing gateway node";
    if (!types.has("security-monitor")) return "missing security-monitor node";
    return null;
  },

  /** At least one ids node connects to security-monitor. */
  function idsAdjacentToMonitor(network) {
    const monitorIds = network.nodes.filter((n) => n.type === "security-monitor").map((n) => n.id);
    const hasLink = network.edges.some(
      ({ source, target }) =>
        (monitorIds.includes(target) && network.nodes.find((n) => n.id === source)?.type === "ids") ||
        (monitorIds.includes(source) && network.nodes.find((n) => n.id === target)?.type === "ids")
    );
    return hasLink ? null : "no ids node adjacent to security-monitor";
  },

  /** At least one lootable node type (fileserver or cryptovault) exists. */
  function missionTargetExists(network) {
    const types = network.nodes.map((n) => n.type);
    return types.includes("fileserver") || types.includes("cryptovault")
      ? null
      : "no lootable node (fileserver or cryptovault)";
  },

  /** Every node has at least one edge. */
  function noOrphanNodes(network) {
    const adj = buildAdjacency(network);
    for (const node of network.nodes) {
      if (!adj[node.id] || adj[node.id].length === 0) {
        return `orphan node: ${node.id} (${node.type})`;
      }
    }
    return null;
  },

  /** BFS from startNode reaches at least one fileserver or cryptovault. */
  function gatewayReachesTarget(network) {
    const adj = buildAdjacency(network);
    const visited = new Set([network.startNode]);
    const queue = [network.startNode];
    while (queue.length) {
      const cur = queue.shift();
      const node = network.nodes.find((n) => n.id === cur);
      if (node && (node.type === "fileserver" || node.type === "cryptovault")) {
        return null; // reachable
      }
      for (const neighbor of (adj[cur] || [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    return "no lootable node reachable from startNode";
  },
];
