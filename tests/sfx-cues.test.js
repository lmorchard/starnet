import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCue } from "../js/audio/sfx/cues.js";
import { E } from "../js/core/events.js";
import { CUES } from "../js/audio/sfx/defs.js";

// ACTION_RESOLVED — xploit
test("xploit success -> xploit.ok", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "xploit", success: true }), "xploit.ok");
});

test("xploit failure -> xploit.fail", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "xploit", success: false }), "xploit.fail");
});

// ACTION_RESOLVED — mine outcomes (card escalates by rarity)
test("mine card common -> mine.common", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "card", rarity: "common" } }), "mine.common");
});

test("mine card uncommon -> mine.uncommon", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "card", rarity: "uncommon" } }), "mine.uncommon");
});

test("mine card rare -> mine.rare", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "card", rarity: "rare" } }), "mine.rare");
});

test("mine card with unknown/absent rarity -> mine.common (fallback)", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "card" } }), "mine.common");
});

test("mine trap outcome -> mine.trap", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "trap" } }), "mine.trap");
});

test("mine miss outcome -> mine.miss", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "miss" } }), "mine.miss");
});

test("mine unknown outcome -> null", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "unknown" } }), null);
});

// ACTION_RESOLVED — fetch (value tiers + trap)
test("fetch with trap -> fetch.trap", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "fetch", detail: { trap: true } }), "fetch.trap");
});

test("fetch small haul -> fetch", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "fetch", detail: { total: 500 } }), "fetch");
});

test("fetch big haul -> fetch.big", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "fetch", detail: { total: 9000 } }), "fetch.big");
});

test("fetch with no detail -> fetch (small)", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "fetch" }), "fetch");
});

// ACTION_RESOLVED — simple actions
test("probe -> probe", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "probe" }), "probe");
});

test("dump -> dump", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "dump" }), "dump");
});

test("corrupt -> corrupt", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "corrupt" }), "corrupt");
});

test("unknown action -> null", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { action: "bogus" }), null);
});

// ICE_MOVED
test("ICE_MOVED toVisible:true -> ice.move", () => {
  assert.equal(resolveCue(E.ICE_MOVED, { toVisible: true }), "ice.move");
});

test("ICE_MOVED toVisible:false -> null", () => {
  assert.equal(resolveCue(E.ICE_MOVED, { toVisible: false }), null);
});

// ALERT_GLOBAL_RAISED
test("ALERT_GLOBAL_RAISED next:trace -> null", () => {
  assert.equal(resolveCue(E.ALERT_GLOBAL_RAISED, { next: "trace" }), null);
});

test("ALERT_GLOBAL_RAISED next:red -> alert.up", () => {
  assert.equal(resolveCue(E.ALERT_GLOBAL_RAISED, { next: "red" }), "alert.up");
});

test("ALERT_GLOBAL_RAISED next:yellow -> alert.up", () => {
  assert.equal(resolveCue(E.ALERT_GLOBAL_RAISED, { next: "yellow" }), "alert.up");
});

// PLAYER_NAVIGATED
test("PLAYER_NAVIGATED with nodeId -> navigate", () => {
  assert.equal(resolveCue(E.PLAYER_NAVIGATED, { nodeId: "n1" }), "navigate");
});

test("PLAYER_NAVIGATED with null nodeId -> null", () => {
  assert.equal(resolveCue(E.PLAYER_NAVIGATED, { nodeId: null }), null);
});

// RUN_ENDED — all outcomes
test("RUN_ENDED outcome:success -> run.success", () => {
  assert.equal(resolveCue(E.RUN_ENDED, { outcome: "success" }), "run.success");
});

test("RUN_ENDED outcome:caught -> run.caught", () => {
  assert.equal(resolveCue(E.RUN_ENDED, { outcome: "caught" }), "run.caught");
});

test("RUN_ENDED outcome:burned -> run.burned", () => {
  assert.equal(resolveCue(E.RUN_ENDED, { outcome: "burned" }), "run.burned");
});

test("RUN_ENDED outcome:bricked -> run.bricked", () => {
  assert.equal(resolveCue(E.RUN_ENDED, { outcome: "bricked" }), "run.bricked");
});

// Direct mappings
test("NODE_REVEALED -> reveal", () => {
  assert.equal(resolveCue(E.NODE_REVEALED, {}), "reveal");
});

test("MISSION_COMPLETE -> mission", () => {
  assert.equal(resolveCue(E.MISSION_COMPLETE, {}), "mission");
});

test("EXPLOIT_DISCLOSED -> decay", () => {
  assert.equal(resolveCue(E.EXPLOIT_DISCLOSED, {}), "decay");
});

test("NODE_ACCESSED next:open -> access.open", () => {
  assert.equal(resolveCue(E.NODE_ACCESSED, { next: "open" }), "access.open");
});

test("NODE_ACCESSED next:owned -> access.owned", () => {
  assert.equal(resolveCue(E.NODE_ACCESSED, { next: "owned" }), "access.owned");
});

test("NODE_ALERT_RAISED next:green -> null", () => {
  assert.equal(resolveCue(E.NODE_ALERT_RAISED, { next: "green" }), null);
});

test("NODE_ALERT_RAISED next:red -> node.alert", () => {
  assert.equal(resolveCue(E.NODE_ALERT_RAISED, { next: "red" }), "node.alert");
});

test("EXPLOIT_PARTIAL_BURN -> burn", () => {
  assert.equal(resolveCue(E.EXPLOIT_PARTIAL_BURN, { usesRemaining: 1 }), "burn");
});

test("ALERT_COOLED -> alert.down", () => {
  assert.equal(resolveCue(E.ALERT_COOLED, {}), "alert.down");
});

test("ALERT_TRACE_STARTED -> trace.start", () => {
  assert.equal(resolveCue(E.ALERT_TRACE_STARTED, {}), "trace.start");
});

test("ALERT_TRACE_CANCELLED -> trace.cancel", () => {
  assert.equal(resolveCue(E.ALERT_TRACE_CANCELLED, {}), "trace.cancel");
});

test("ICE_DETECT_PENDING -> ice.pending", () => {
  assert.equal(resolveCue(E.ICE_DETECT_PENDING, {}), "ice.pending");
});

test("ICE_DETECTED -> ice.locked", () => {
  assert.equal(resolveCue(E.ICE_DETECTED, {}), "ice.locked");
});

test("ICE_EJECTED -> ice.ejected", () => {
  assert.equal(resolveCue(E.ICE_EJECTED, {}), "ice.ejected");
});

test("ICE_REBOOTED -> ice.reboot", () => {
  assert.equal(resolveCue(E.ICE_REBOOTED, {}), "ice.reboot");
});

test("ICE_DISABLED -> ice.down", () => {
  assert.equal(resolveCue(E.ICE_DISABLED, {}), "ice.down");
});

test("RUN_STARTED -> run.start", () => {
  assert.equal(resolveCue(E.RUN_STARTED, {}), "run.start");
});

// Unknown event
test("unknown event type -> null", () => {
  assert.equal(resolveCue("totally:unknown", {}), null);
});

// Exhaustiveness: every non-null id resolveCue can return must exist in CUES
test("all resolvable cue ids exist in CUES", () => {
  const returnedIds = new Set();

  // Exercise every branch
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "probe" }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "dump" }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "corrupt" }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "xploit", success: true }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "xploit", success: false }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "fetch", detail: { trap: true } }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "fetch", detail: { total: 500 } }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "fetch", detail: { total: 9000 } }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "card", rarity: "common" } }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "card", rarity: "uncommon" } }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "card", rarity: "rare" } }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "trap" } }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "miss" } }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "mine", detail: { outcome: "unknown" } }));
  returnedIds.add(resolveCue(E.ACTION_RESOLVED, { action: "bogus" }));
  returnedIds.add(resolveCue(E.NODE_REVEALED, {}));
  returnedIds.add(resolveCue(E.NODE_ACCESSED, { next: "open" }));
  returnedIds.add(resolveCue(E.NODE_ACCESSED, { next: "owned" }));
  returnedIds.add(resolveCue(E.NODE_ALERT_RAISED, { next: "green" }));
  returnedIds.add(resolveCue(E.NODE_ALERT_RAISED, { next: "red" }));
  returnedIds.add(resolveCue(E.EXPLOIT_PARTIAL_BURN, { usesRemaining: 1 }));
  returnedIds.add(resolveCue(E.PLAYER_NAVIGATED, { nodeId: "n1" }));
  returnedIds.add(resolveCue(E.PLAYER_NAVIGATED, { nodeId: null }));
  returnedIds.add(resolveCue(E.ALERT_GLOBAL_RAISED, { next: "trace" }));
  returnedIds.add(resolveCue(E.ALERT_GLOBAL_RAISED, { next: "red" }));
  returnedIds.add(resolveCue(E.ALERT_COOLED, {}));
  returnedIds.add(resolveCue(E.ALERT_TRACE_STARTED, {}));
  returnedIds.add(resolveCue(E.ALERT_TRACE_CANCELLED, {}));
  returnedIds.add(resolveCue(E.ICE_DETECT_PENDING, {}));
  returnedIds.add(resolveCue(E.ICE_DETECTED, {}));
  returnedIds.add(resolveCue(E.ICE_EJECTED, {}));
  returnedIds.add(resolveCue(E.ICE_REBOOTED, {}));
  returnedIds.add(resolveCue(E.ICE_DISABLED, {}));
  returnedIds.add(resolveCue(E.ICE_MOVED, { toVisible: true }));
  returnedIds.add(resolveCue(E.ICE_MOVED, { toVisible: false }));
  returnedIds.add(resolveCue(E.RUN_STARTED, {}));
  returnedIds.add(resolveCue(E.RUN_ENDED, { outcome: "success" }));
  returnedIds.add(resolveCue(E.RUN_ENDED, { outcome: "caught" }));
  returnedIds.add(resolveCue(E.RUN_ENDED, { outcome: "burned" }));
  returnedIds.add(resolveCue(E.RUN_ENDED, { outcome: "bricked" }));
  returnedIds.add(resolveCue(E.MISSION_COMPLETE, {}));
  returnedIds.add(resolveCue(E.EXPLOIT_DISCLOSED, {}));
  returnedIds.add(resolveCue("totally:unknown", {}));

  // Remove nulls; every non-null id must exist in CUES
  returnedIds.delete(null);
  for (const id of returnedIds) {
    assert.ok(id in CUES, `resolveCue returned "${id}" but it is not a key in CUES`);
  }
});
