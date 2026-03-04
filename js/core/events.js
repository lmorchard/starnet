// @ts-check
// Event bus — pub/sub system and catalog of all game event types.
// No game logic, no imports from other game modules.

/** @type {Map<string, Set<Function>>} */
const handlers = new Map();

export function emitEvent(type, payload = {}) {
  const set = handlers.get(type);
  if (!set) return;
  for (const fn of set) fn(payload);
}

export function on(type, handler) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(handler);
}

export function off(type, handler) {
  handlers.get(type)?.delete(handler);
}

export function clearHandlers() {
  handlers.clear();
}

// All event type string constants.
export const E = Object.freeze({
  STATE_CHANGED:        "state:changed",
  TIMERS_UPDATED:       "timers:updated",
  LOG_ENTRY:            "log:entry",

  RUN_STARTED:          "run:started",
  RUN_ENDED:            "run:ended",

  NODE_REVEALED:        "node:revealed",
  NODE_PROBED:          "node:probed",
  NODE_ACCESSED:        "node:accessed",
  NODE_ALERT_RAISED:    "node:alert-raised",
  NODE_READ:            "node:read",
  NODE_LOOTED:          "node:looted",
  NODE_RECONFIGURED:    "node:reconfigured",
  NODE_REBOOTING:       "node:rebooting",
  NODE_REBOOTED:        "node:rebooted",

  PROBE_SCAN_STARTED:   "probe:scan-started",
  PROBE_SCAN_CANCELLED: "probe:scan-cancelled",

  READ_SCAN_STARTED:    "read:scan-started",
  READ_SCAN_CANCELLED:  "read:scan-cancelled",

  LOOT_EXTRACT_STARTED:   "loot:extract-started",
  LOOT_EXTRACT_CANCELLED: "loot:extract-cancelled",

  EXPLOIT_STARTED:      "exploit:started",
  EXPLOIT_NOISE:        "exploit:noise",
  EXPLOIT_INTERRUPTED:  "exploit:interrupted",
  EXPLOIT_SUCCESS:      "exploit:success",
  EXPLOIT_FAILURE:      "exploit:failure",
  EXPLOIT_DISCLOSED:    "exploit:disclosed",
  EXPLOIT_PARTIAL_BURN: "exploit:partial-burn",
  EXPLOIT_SURFACE:      "exploit:surface-revealed",

  ALERT_GLOBAL_RAISED:   "alert:global-raised",
  ALERT_TRACE_STARTED:   "alert:trace-started",
  ALERT_TRACE_CANCELLED: "alert:trace-cancelled",
  ALERT_PROPAGATED:      "alert:propagated",

  PLAYER_NAVIGATED:     "player:navigated",

  ICE_MOVED:            "ice:moved",
  ICE_DETECT_PENDING:   "ice:detect-pending",
  ICE_DETECTED:         "ice:detected",
  ICE_EJECTED:          "ice:ejected",
  ICE_REBOOTED:         "ice:rebooted",
  ICE_DISABLED:         "ice:disabled",

  MISSION_STARTED:      "mission:started",
  MISSION_COMPLETE:     "mission:complete",

  COMMAND_ISSUED:       "command:issued",

  // NodeGraph events — emitted by the onEvent bridge
  NODE_STATE_CHANGED:   "graph:node-state-changed",
  MESSAGE_PROPAGATED:   "graph:message-propagated",
  QUALITY_CHANGED:      "graph:quality-changed",
});
