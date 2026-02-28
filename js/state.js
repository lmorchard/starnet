// @ts-check
// Re-export shim — all state logic lives in state/index.js.
// This file exists so existing `import ... from "./state.js"` paths continue to work.

export {
  // Core
  initState, getState, mutate, getVersion, emit,
  // Node access
  accessNode, revealNeighbors, accessNeighbors, setAccessLevel,
  // Alert
  ALERT_ORDER, raiseNodeAlert,
  // End run
  endRun,
  // Probe
  probeNode,
  // Read & Loot
  readNode, lootNode,
  // Reconfigure
  reconfigureNode,
  // Cheats
  setCheating,
  // ICE
  moveIceAttention, ejectIce, rebootIce, disableIce,
  // Node reboot
  rebootNode, completeReboot,
  // Selection
  selectNode, deselectNode,
  // Visibility
  isIceVisible,
  // Store
  buyExploit,
  // Serialization
  serializeState, deserializeState,
} from "./state/index.js";
