// @ts-check
// Re-export shim — all state logic lives in state/ submodules.
// This file exists so existing `import ... from "./state.js"` paths continue to work.

export {
  // Core
  initGame, getState, mutate, getVersion,
  // Graph traversal utilities
  revealNeighbors, accessNeighbors,
  // Alert constants
  ALERT_ORDER,
  // End run
  endRun,
  // Visibility
  isIceVisible,
  // Store
  buyExploit,
  // Serialization
  serializeState, deserializeState,
} from "./state/index.js";

export {
  setNodeVisible, setNodeAccessLevel, setNodeProbed, setNodeAlertState,
  setNodeRead, collectMacguffins, setNodeLooted, setNodeRebooting,
  setNodeEventForwarding, setNodeVulnHidden, setNodeGraph,
} from "./state/node.js";

export {
  setIceAttention, setIceDetectedAt, setIceDwellTimer,
  incrementIceDetectionCount, setIceActive, setLastDisturbedNode,
} from "./state/ice.js";

export {
  setGlobalAlert, setTraceCountdown, setTraceTimerId, decrementTraceCountdown,
} from "./state/alert.js";

export {
  addCash, setCash, addCardToHand, setExecutingExploit,
  incrementNoiseTick, setActiveProbe, setMissionComplete, applyCardDecay,
} from "./state/player.js";

export {
  setSelectedNode, setPhase, setRunOutcome,
} from "./state/game.js";
