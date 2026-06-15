// @ts-check
// Pure event -> cue mapping. Returns a cue id (key in defs.js CUES) or null. No side effects.
// Health/deck damage cues are NOT handled here (the renderer derives them from STATE_CHANGED diffs).
// NODE_REVEALED grade/type + burst-cascade pitch are applied renderer-side (needs getState()).
import { E } from "../../core/events.js";

/** Mining card hit → cue id by rarity (escalating motif). */
const MINE_RARITY = { common: "mine.common", uncommon: "mine.uncommon", rare: "mine.rare" };
/** A fetch haul at or above this total cash value gets the richer "big haul" cue. */
const FETCH_BIG_TOTAL = 3000;

/**
 * Map a game event to a sound-cue id.
 * @param {string} type  the E.* event string
 * @param {any} payload  the event payload
 * @returns {string|null} cue id, or null for "no cue"
 */
export function resolveCue(type, payload) {
  switch (type) {
    case E.ACTION_RESOLVED: {
      const a = payload?.action;
      if (a === "probe") return "probe";
      if (a === "dump") return "dump";
      if (a === "corrupt") return "corrupt";
      if (a === "xploit") return payload?.success ? "xploit.ok" : "xploit.fail";
      if (a === "fetch") {
        if (payload?.detail?.trap) return "fetch.trap";
        return (payload?.detail?.total ?? 0) >= FETCH_BIG_TOTAL ? "fetch.big" : "fetch";
      }
      if (a === "mine") {
        const d = payload?.detail;
        if (d?.outcome === "trap") return "mine.trap";
        if (d?.outcome === "miss") return "mine.miss";
        if (d?.outcome === "card") return MINE_RARITY[/** @type {string} */ (d?.rarity)] ?? "mine.common";
        return null;
      }
      return null;
    }
    case E.NODE_REVEALED:         return "reveal";
    case E.NODE_ACCESSED:         return payload?.next === "owned" ? "access.owned" : "access.open";
    case E.PLAYER_NAVIGATED:      return payload?.nodeId ? "navigate" : null;
    case E.ALERT_GLOBAL_RAISED:   return payload?.next === "trace" ? null : "alert.up";
    case E.ALERT_COOLED:          return "alert.down";
    case E.ALERT_TRACE_STARTED:   return "trace.start";
    case E.ALERT_TRACE_CANCELLED: return "trace.cancel";
    case E.NODE_ALERT_RAISED:     return payload?.next === "green" ? null : "node.alert";
    case E.ICE_DETECT_PENDING:    return "ice.pending";
    case E.ICE_DETECTED:          return "ice.locked";
    case E.ICE_EJECTED:           return "ice.ejected";
    case E.ICE_REBOOTED:          return "ice.reboot";
    case E.ICE_DISABLED:          return "ice.down";
    case E.ICE_MOVED:             return payload?.toVisible ? "ice.move" : null;
    case E.RUN_STARTED:           return "run.start";
    case E.RUN_ENDED:             return payload?.outcome ? "run." + payload.outcome : null;
    case E.MISSION_COMPLETE:      return "mission";
    case E.EXPLOIT_DISCLOSED:     return "decay";
    case E.EXPLOIT_PARTIAL_BURN:  return "burn";
    default: return null;
  }
}
