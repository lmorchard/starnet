// @ts-check
/**
 * Corporate biome set-pieces — filler & treasure pieces.
 *
 * Part of the corporate-pieces/ catalog. The barrel at ../corporate-pieces.js
 * re-exports these and assembles SET_PIECES.
 */

/** @typedef {import("../../../js/core/network/set-pieces.js").SetPieceDef} SetPieceDef */

/**
 * Server Bank
 *
 * Pattern: a cluster of plain fileserver nodes connected to a common hub.
 * No puzzles, no defenses — just straightforward loot. The hub routes
 * traffic between the servers and the rest of the network.
 *
 * External ports: ['hub', 'server-1', 'server-2', 'server-3']
 * The hub is the entry point; servers are lootable.
 *
 * @type {SetPieceDef}
 */
export const serverBank = {
  id: "server-bank",
  description: "Cluster of three lootable fileservers connected to a hub.",
  nodes: [
    {
      id: "hub",
      type: "router",
      traits: ["graded", "hackable", "rebootable", "gate"],
      attributes: { accessLevel: "locked", gateAccess: "open" },
      operators: [{ name: "relay" }],
      actions: [],
    },
    {
      id: "server-1",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "server-2",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "server-3",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [
    ["hub", "server-1"],
    ["hub", "server-2"],
    ["hub", "server-3"],
  ],
  triggers: [],
  externalPorts: ["hub", "server-1", "server-2", "server-3"],
  tags: ["filler", "treasure"],
  cost: "D",
  ports: [
    { nodeId: "hub", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "server-1", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "server-2", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "server-3", direction: "outbound", wantsTags: [], required: false },
  ],
};

/**
 * Office Cluster
 *
 * Pattern: a few workstations connected to a fileserver. Exploration filler.
 * Workstations might hold small loot; the fileserver is the main prize.
 * No defenses, no puzzles — just territory to map and harvest.
 *
 * External ports: ['fileserver', 'workstation-1', 'workstation-2']
 *
 * @type {SetPieceDef}
 */
export const officeCluster = {
  id: "office-cluster",
  description: "Workstations connected to a fileserver. Exploration filler with light loot.",
  nodes: [
    {
      id: "fileserver",
      type: "fileserver",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "workstation-1",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
    {
      id: "workstation-2",
      type: "workstation",
      traits: ["graded", "hackable", "rebootable", "lootable", "gate"],
      attributes: { accessLevel: "locked" },
      operators: [],
      actions: [],
    },
  ],
  internalEdges: [
    ["fileserver", "workstation-1"],
    ["fileserver", "workstation-2"],
  ],
  triggers: [],
  externalPorts: ["fileserver", "workstation-1", "workstation-2"],
  tags: ["filler", "treasure"],
  cost: "D",
  ports: [
    { nodeId: "fileserver", direction: "inbound", wantsTags: [], required: true },
    { nodeId: "workstation-1", direction: "outbound", wantsTags: [], required: false },
    { nodeId: "workstation-2", direction: "outbound", wantsTags: [], required: false },
  ],
};
