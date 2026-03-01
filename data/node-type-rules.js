// @ts-check
// Topology rule data for the procedural LAN generator.
// Each entry describes how a node type participates in network generation.
// This is pure data — no runtime logic. The generator reads these rules;
// they are not hard-coded into the algorithm.
//
// Fields:
//   singleton      — at most one of this type per network
//   depth          — target depth layer (0 = gateway level)
//   connectsTo     — downstream node types this type connects to (repetition = weight)
//   gateType       — node gates neighbor reveal (requires owning before connections visible)
//   leaf           — no outgoing connections to content/routing nodes
//   security       — part of the IDS/monitor security chain
//   mustBehindGate — must have a gate-type node on the path from gateway
//   iceResident    — ICE starts here at run init
//   minCount       — minimum instances in a generated network (0 = optional)
//   maxCount       — maximum instances in a generated network

/** @type {Record<string, object>} */
export const NODE_GEN_RULES = {
  wan: {
    singleton:   true,
    depth:       -1,
    connectsTo:  ["gateway"],
    leaf:        false,
  },

  gateway: {
    singleton:   true,
    depth:       0,
    // router weighted higher than firewall — most paths go through routing layer
    connectsTo:  ["router", "router", "firewall"],
    leaf:        false,
  },

  router: {
    singleton:   false,
    depth:       1,
    connectsTo:  ["workstation", "workstation", "fileserver"],
    leaf:        false,
    minCount:    1,
    maxCount:    2,
  },

  firewall: {
    singleton:   false,
    gateType:    true,
    depth:       1,
    connectsTo:  ["fileserver", "cryptovault"],
    leaf:        false,
    minCount:    0,
    maxCount:    1,
  },

  workstation: {
    singleton:   false,
    depth:       2,
    connectsTo:  [],
    leaf:        true,
    minCount:    1,
    maxCount:    3,
  },

  fileserver: {
    singleton:   false,
    depth:       2,
    connectsTo:  [],
    leaf:        true,
    minCount:    1,
    maxCount:    2,
  },

  cryptovault: {
    singleton:   false,
    mustBehindGate: true,
    depth:       3,
    connectsTo:  [],
    leaf:        true,
    minCount:    0,
    maxCount:    1,
  },

  ids: {
    singleton:   false,
    security:    true,
    depth:       2,
    connectsTo:  ["security-monitor"],
    leaf:        false,
    minCount:    1,
    maxCount:    1,
  },

  "security-monitor": {
    singleton:   true,
    security:    true,
    iceResident: true,
    depth:       3,
    connectsTo:  [],
    leaf:        true,
  },
};
