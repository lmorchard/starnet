import { test } from "node:test";
import assert from "node:assert/strict";
import { CUES, resolveCue, resolveActionCue } from "../js/audio/strudel/data/cues.js";
import { E } from "../js/core/events.js";
import { DEFAULT_PROFILE, ACTION_FEEDBACK_PROFILES } from "../js/ui/feedback-profiles.js";
import { A } from "../js/core/action-ids.js";

// Existing event→cue resolution (unaffected by #187 Phase 3) — regression coverage.
test("resolveCue maps known event types to their cue spec, unknown → null", () => {
  assert.equal(resolveCue(E.NODE_REVEALED), CUES.reveal);
  assert.equal(resolveCue(E.NODE_ACCESSED), CUES.access);
  assert.equal(resolveCue(E.ACTION_RESOLVED, { success: true }), CUES["xploit.ok"]);
  assert.equal(resolveCue(E.ACTION_RESOLVED, { success: false }), CUES["xploit.fail"]);
  assert.equal(resolveCue(E.ICE_DETECTED), CUES["ice.detected"]);
  assert.equal(resolveCue(E.ALERT_TRACE_STARTED), CUES["trace.start"]);
  assert.equal(resolveCue("some:other:event"), null);
});

// #187 Phase 3 — resolveActionCue resolves a *timed-action completion* cue id, a new concept with
// no legacy per-action map to fall back to (resolveCue above is keyed by event TYPE, not action
// id, and serves a different moment — ACTION_RESOLVED, not ACTION_FEEDBACK completion).
test("resolveActionCue falls to DEFAULT_PROFILE.completionCue when nothing else is set", () => {
  assert.equal(resolveActionCue(A.PROBE), DEFAULT_PROFILE.completionCue);
  assert.equal(resolveActionCue("crack-vault"), DEFAULT_PROFILE.completionCue);
});

test("the DEFAULT completion cue id isn't backed by a real CUES entry until Phase 4", () => {
  assert.equal(CUES[DEFAULT_PROFILE.completionCue], undefined);
});

test("resolveActionCue: inline wins over central and DEFAULT", () => {
  assert.equal(resolveActionCue(A.PROBE, { completionCue: "custom.cue" }), "custom.cue");
});

test("resolveActionCue: a central completionCue override (if one existed) would win over DEFAULT", () => {
  const original = ACTION_FEEDBACK_PROFILES[A.PROBE];
  ACTION_FEEDBACK_PROFILES[A.PROBE] = { ...original, completionCue: "central.cue" };
  try {
    assert.equal(resolveActionCue(A.PROBE), "central.cue");
  } finally {
    ACTION_FEEDBACK_PROFILES[A.PROBE] = original;
  }
});
