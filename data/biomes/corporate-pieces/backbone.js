// @ts-check
/**
 * Corporate biome set-pieces — backbone spine pieces.
 *
 * Part of the corporate-pieces/ catalog. The barrel at ../corporate-pieces.js
 * re-exports these and assembles SET_PIECES.
 */

/** @typedef {import("../../../js/core/network/set-pieces.js").SetPieceDef} SetPieceDef */

// ---------------------------------------------------------------------------
// Backbone set-pieces — spine nodes connecting wings in hierarchical networks.
// All backbone pieces include relay operators for alert message propagation.
// ---------------------------------------------------------------------------

/**
 * Backbone router — the standard backbone spine node. 1 inbound, 2 outbound.
 * Relays alert messages so security signals propagate across wings.
 * @type {SetPieceDef}
 */
export const backboneRouter = {
  id: "backbone-router",
  description: "Backbone router: connects network wings, relays alert signals.",
  nodes: [
    {
      id: "router",
      type: "router",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "open" },
      operators: [{ name: "relay" }],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["router"],
  tags: ["backbone"],
  cost: "F",
  ports: [
    { nodeId: "router", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "router", direction: "outbound", wantsTags: [], required: true },
    { nodeId: "router", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Backbone firewall — higher-grade chokepoint on the backbone. 1 inbound, 1 outbound.
 * Harder to crack than a router; relays alert messages.
 * @type {SetPieceDef}
 */
export const backboneFirewall = {
  id: "backbone-firewall",
  description: "Backbone firewall: high-grade chokepoint between network wings.",
  nodes: [
    {
      id: "firewall",
      type: "firewall",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "owned" },
      operators: [{ name: "relay", filter: "alert" }],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["firewall"],
  tags: ["backbone"],
  cost: "C",
  ports: [
    { nodeId: "firewall", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "firewall", direction: "outbound", wantsTags: [], required: true },
  ],
};

/**
 * Backbone hub — wide backbone node with extra outbound ports. 1 inbound, 3 outbound.
 * Creates branching points on the backbone itself.
 * @type {SetPieceDef}
 */
export const backboneHub = {
  id: "backbone-hub",
  description: "Backbone hub: wide router with multiple outbound connections.",
  nodes: [
    {
      id: "hub",
      type: "router",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "open" },
      operators: [{ name: "relay" }],
      actions: [],
    },
  ],
  internalEdges: [],
  triggers: [],
  externalPorts: ["hub"],
  tags: ["backbone"],
  cost: "D",
  ports: [
    { nodeId: "hub", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "hub", direction: "outbound", wantsTags: [], required: true },
    { nodeId: "hub", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "hub", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Backbone set-pieces.
 */
export const BACKBONE_PIECES = {
  backboneRouter,
  backboneFirewall,
  backboneHub,
};
