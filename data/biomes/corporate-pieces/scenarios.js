// @ts-check
/**
 * Corporate biome set-pieces — narrative scenario pieces.
 *
 * Part of the corporate-pieces/ catalog. The barrel at ../corporate-pieces.js
 * re-exports these and assembles SET_PIECES.
 */

/** @typedef {import("../../../js/core/network/set-pieces.js").SetPieceDef} SetPieceDef */

// ---------------------------------------------------------------------------
// Scenario set-pieces — narrative-flavored configurations that create
// interesting tactical situations through grade asymmetry or topology.
// ---------------------------------------------------------------------------

/**
 * Workstation Array — a router hub connected to 4 workstations.
 * Methodical looting: many small targets behind a single gate.
 * Each workstation has small loot; the volume adds up.
 *
 * @type {SetPieceDef}
 */
export const workstationArray = {
  id: "workstation-array",
  description: "Array of four workstations behind a hub router. Methodical looting territory.",
  nodes: [
    {
      id: "hub",
      type: "router",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "probed" },
      operators: [{ name: "relay" }],
      actions: [],
    },
    {
      id: "ws-1",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "ws-2",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "ws-3",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "ws-4",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [
    ["hub", "ws-1"],
    ["hub", "ws-2"],
    ["hub", "ws-3"],
    ["hub", "ws-4"],
  ],
  triggers: [],
  externalPorts: ["hub", "ws-1", "ws-2", "ws-3", "ws-4"],
  tags: ["filler", "treasure"],
  cost: "D",
  ports: [
    { nodeId: "hub", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "ws-1", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "ws-2", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "ws-3", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "ws-4", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Lucky Break — a low-grade firewall guarding a cryptovault.
 * The corp cut corners on perimeter hardening but the vault itself is standard.
 * Easy entry, normal prize. The player who spots this saves time.
 *
 * Grade asymmetry: firewall is 2 grades below default, vault is at default.
 * After network-level grade shift, the relative gap is preserved.
 *
 * @type {SetPieceDef}
 */
export const luckyBreak = {
  id: "lucky-break",
  description: "Weak firewall guarding a cryptovault. Someone cut corners on hardening.",
  nodes: [
    {
      id: "weak-gate",
      type: "firewall",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "owned", grade: "F" },
      operators: [],
      actions: [],
    },
    {
      id: "vault",
      type: "cryptovault",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked", grade: "C" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [["weak-gate", "vault"]],
  triggers: [],
  externalPorts: ["weak-gate", "vault"],
  tags: ["treasure"],
  cost: "C",
  ports: [
    { nodeId: "weak-gate", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "vault", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Security Theater — a high-grade firewall protecting low-grade fileservers.
 * The corp invested in a flashy perimeter but the interior is soft.
 * Hard entry, easy loot. Rewards the player who commits to cracking the gate.
 *
 * Grade asymmetry: firewall is 2 grades above default, fileservers are 2 below.
 *
 * @type {SetPieceDef}
 */
export const securityTheater = {
  id: "security-theater",
  description: "Imposing firewall, unprotected fileservers behind it. All bark, no bite inside.",
  nodes: [
    {
      id: "hard-gate",
      type: "firewall",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "owned", grade: "B" },
      operators: [],
      actions: [],
    },
    {
      id: "soft-server-1",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked", grade: "F" },
      operators: [],
      actions: [],
    },
    {
      id: "soft-server-2",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked", grade: "F" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [
    ["hard-gate", "soft-server-1"],
    ["hard-gate", "soft-server-2"],
  ],
  triggers: [],
  externalPorts: ["hard-gate", "soft-server-1", "soft-server-2"],
  tags: ["gate", "treasure"],
  cost: "C",
  ports: [
    { nodeId: "hard-gate", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "soft-server-1", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "soft-server-2", direction: "outbound", wantsTags: [], required: false },
  ],
};
