import { test } from "node:test";
import assert from "node:assert/strict";
import { E } from "../js/core/events.js";
import { CUES, resolveCue } from "../js/audio/strudel/data/cues.js";

test("ACTION_RESOLVED splits success vs failure", () => {
  assert.equal(resolveCue(E.ACTION_RESOLVED, { success: true }), CUES["xploit.ok"]);
  assert.equal(resolveCue(E.ACTION_RESOLVED, { success: false }), CUES["xploit.fail"]);
});

test("NODE_REVEALED / NODE_ACCESSED / ICE_DETECTED / ALERT_TRACE_STARTED map to their cues", () => {
  assert.equal(resolveCue(E.NODE_REVEALED, {}), CUES.reveal);
  assert.equal(resolveCue(E.NODE_ACCESSED, {}), CUES.access);
  assert.equal(resolveCue(E.ICE_DETECTED, {}), CUES["ice.detected"]);
  assert.equal(resolveCue(E.ALERT_TRACE_STARTED, {}), CUES["trace.start"]);
});

test("ALERT_GLOBAL_RAISED sounds the alert cue, but is suppressed at trace (trace.start covers it)", () => {
  assert.equal(resolveCue(E.ALERT_GLOBAL_RAISED, { next: "red" }), CUES["alert.up"]);
  assert.equal(resolveCue(E.ALERT_GLOBAL_RAISED, { next: "trace" }), null);
});

test("an unmapped event resolves to null", () => {
  assert.equal(resolveCue("some:unmapped:event", {}), null);
});

test("every cue spec carries a positive _dur and a note", () => {
  for (const [id, spec] of Object.entries(CUES)) {
    assert.ok(typeof spec._dur === "number" && spec._dur > 0, `${id} needs a positive _dur`);
    assert.ok(spec.note, `${id} needs a note`);
  }
});
