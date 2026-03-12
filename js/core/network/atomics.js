// @ts-check
/**
 * Atomic set-pieces — single-node (or few-node) building blocks for the
 * "everything is a set-piece" model. These fill structural roles that the
 * larger set-pieces don't cover: entry points, spine nodes, gates, and
 * leaf filler.
 */

/** @typedef {import('./set-pieces.js').SetPieceDef} SetPieceDef */

/**
 * Entry point — gateway + WAN. Exactly one per network.
 * The gateway is the player's starting node; the WAN provides darknet access.
 * @type {SetPieceDef}
 */
export const entryPoint = {
  id: "entry-point",
  description: "Network entry: gateway (player start) + WAN (darknet access).",
  nodes: [
    {
      id: "gateway",
      type: "gateway",
      attributes: { accessLevel: "locked", visibility: "accessible" },
      operators: [],
      actions: [],
    },
    {
      id: "wan",
      type: "wan",
      attributes: { accessLevel: "owned", visibility: "accessible" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [["gateway", "wan"]],
  triggers: [],
  externalPorts: ["gateway"],
  tags: ["entry"],
  cost: "F",
  ports: [
    { nodeId: "gateway", direction: "outbound", wantsTags: ["spine", "gate"], required: true },
  ],
};

/**
 * Single router — spine node with multiple outbound ports for branching.
 * Compromise to reveal the network beyond.
 * @type {SetPieceDef}
 */
export const singleRouter = {
  id: "single-router",
  description: "Router node: compromise to reveal connected segments.",
  nodes: [
    {
      id: "router",
      type: "router",
      attributes: { accessLevel: "locked" },
      operators: [{ name: "relay" }],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["router"],
  tags: ["spine", "gate"],
  cost: "F",
  ports: [
    { nodeId: "router", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "router", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "router", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "router", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Single firewall — gate node that blocks access to deeper content.
 * Own to reveal the network beyond. Higher base grade than a router.
 * @type {SetPieceDef}
 */
export const singleFirewall = {
  id: "single-firewall",
  description: "Firewall node: own to access deeper network segments.",
  nodes: [
    {
      id: "firewall",
      type: "firewall",
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["firewall"],
  tags: ["gate"],
  cost: "D",
  ports: [
    { nodeId: "firewall", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "firewall", direction: "outbound", wantsTags: ["treasure", "puzzle"], required: true },
  ],
};

/**
 * Single workstation — leaf filler node. Cheap exploration target.
 * @type {SetPieceDef}
 */
export const singleWorkstation = {
  id: "single-workstation",
  description: "Workstation node: small loot target, exploration filler.",
  nodes: [
    {
      id: "workstation",
      type: "workstation",
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["workstation"],
  tags: ["filler"],
  cost: "F",
  ports: [
    { nodeId: "workstation", direction: "inbound", wantsTags: [], required: true },
  ],
};

/**
 * Single fileserver — leaf treasure node. Lootable with macguffins.
 * @type {SetPieceDef}
 */
export const singleFileserver = {
  id: "single-fileserver",
  description: "Fileserver node: lootable target with data rewards.",
  nodes: [
    {
      id: "fileserver",
      type: "fileserver",
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["fileserver"],
  tags: ["filler", "treasure"],
  cost: "F",
  ports: [
    { nodeId: "fileserver", direction: "inbound", wantsTags: [], required: true },
  ],
};

/**
 * All atomic set-pieces.
 */
export const ATOMICS = {
  entryPoint,
  singleRouter,
  singleFirewall,
  singleWorkstation,
  singleFileserver,
};
