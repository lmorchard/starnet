// @ts-check
// Re-export shim — all state logic lives in state/ submodules.
// This file exists so existing `import ... from "./state.js"` paths continue to work.

export {
  // Core
  initGame, getState, mutate, getVersion,
  // Graph traversal utilities
  revealNeighbors, accessNeighbors,
  // Alert constants
  ALERT_ORDER, nextAlertLevel,
  // End run
  endRun,
  // Visibility
  isIceVisible,
  // Serialization
  serializeState, deserializeState,
} from "./state/index.js";

export {
  setNodeVisible, setNodeAccessLevel, setNodeProbed, setNodeAlertState,
  setNodeRead, collectMacguffins, setNodeLooted, setNodeRebooting,
  setNodeVulnHidden, setNodeGraph, isObscured,
} from "./state/node.js";

export {
  setIceAttention, setIceDetectedAt, setIceDwellTimer,
  incrementIceDetectionCount, setIceActive, setLastDisturbedNode,
} from "./state/ice.js";

export {
  setGlobalAlert, setTraceCountdown, setTraceTimerId, decrementTraceCountdown,
} from "./state/alert.js";

export {
  addCash, setCash, setMissionComplete,
  addCapturedCredential,
} from "./state/player.js";

export {
  flowId, setFlowRevealed, addHeat, decayHeat, setHeatDecayTimerId,
} from "./state/flow.js";

export {
  nextProcessId, addProcess, updateProcess, removeProcess,
} from "./state/process.js";

export {
  setSelectedNode, setPhase, setRunOutcome, toggleMenuOpen, toggleHandCollapsed,
} from "./state/game.js";
