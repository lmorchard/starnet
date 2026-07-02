// @ts-check
// #187 Phase 3: per-action feedback profile ({ overlay, drone, completionCue }) resolved by a
// field-level layered lookup: inline (ActionDef.feedback / ACTION_FEEDBACK payload.feedback) →
// ACTION_FEEDBACK_PROFILES[actionId] (central) → DEFAULT_PROFILE. Pure resolution only — the
// audio module composes its OWN drone/cue resolution on top of this (see strudel-drones.test.js /
// strudel-cues.test.js) because the legacy resolveDrone() fallback sits BETWEEN central and
// DEFAULT for drones, which this generic 3-layer resolver doesn't know about.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFeedback, ACTION_FEEDBACK_PROFILES, DEFAULT_PROFILE } from "../js/ui/feedback-profiles.js";
import { A } from "../js/core/action-ids.js";

test("DEFAULT_PROFILE is the generic fallback profile (ids registered as of #187 Phase 4b)", () => {
  assert.deepEqual(DEFAULT_PROFILE, {
    overlay: "generic-process",
    drone: "generic",
    completionCue: "process.done",
  });
});

test("an unmapped action resolves entirely to DEFAULT_PROFILE", () => {
  const resolved = resolveFeedback("some-setpiece-verb");
  assert.deepEqual(resolved, DEFAULT_PROFILE);
});

test("a core verb's central overlay override wins over DEFAULT", () => {
  const resolved = resolveFeedback(A.PROBE);
  assert.equal(resolved.overlay, ACTION_FEEDBACK_PROFILES[A.PROBE].overlay);
  assert.notEqual(resolved.overlay, DEFAULT_PROFILE.overlay);
});

test("central profile only overrides the fields it lists — others still fall to DEFAULT", () => {
  // Core verbs list only `overlay` centrally (drone/cue are preserved by the audio module's own
  // resolveDrone fallback, not re-listed here — see js/audio/strudel/index.js).
  const resolved = resolveFeedback(A.PROBE);
  assert.equal(resolved.drone, DEFAULT_PROFILE.drone);
  assert.equal(resolved.completionCue, DEFAULT_PROFILE.completionCue);
});

test("inline wins over central for a field it sets", () => {
  const resolved = resolveFeedback(A.PROBE, { overlay: "custom-overlay" });
  assert.equal(resolved.overlay, "custom-overlay");
});

test("inline layering is per-field — an inline field left unset still falls through to central/DEFAULT", () => {
  const resolved = resolveFeedback(A.PROBE, { drone: "custom-drone" });
  assert.equal(resolved.drone, "custom-drone");
  assert.equal(resolved.overlay, ACTION_FEEDBACK_PROFILES[A.PROBE].overlay, "overlay still falls to central");
  assert.equal(resolved.completionCue, DEFAULT_PROFILE.completionCue, "cue still falls to DEFAULT");
});

test("an unmapped verb resolves overlay/drone/cue all to the DEFAULT ids", () => {
  const resolved = resolveFeedback("crack-vault");
  assert.equal(resolved.overlay, "generic-process");
  assert.equal(resolved.drone, "generic");
  assert.equal(resolved.completionCue, "process.done");
});

test("reboot resolves to the 'none' overlay sentinel, not the generic-process default (#187 default-flip)", () => {
  // reboot is a core verb (excluded from the timed-by-default flip) with its own bespoke
  // node-pulse treatment. Before this central entry existed, an unmapped reboot fell through
  // to DEFAULT_PROFILE's "generic-process" overlay and mounted the generic ring on top of its
  // bespoke pulse. "none" isn't a registered overlay name, so overlay dispatch no-ops for it.
  const resolved = resolveFeedback(A.REBOOT);
  assert.equal(resolved.overlay, "none");
  assert.notEqual(resolved.overlay, DEFAULT_PROFILE.overlay);
});

test("every core verb in the central profile only declares overlay (drone/cue stay the audio module's job)", () => {
  for (const [id, profile] of Object.entries(ACTION_FEEDBACK_PROFILES)) {
    assert.ok(profile.overlay, `${id} should declare a central overlay override`);
    assert.equal(profile.drone, undefined, `${id} should not re-list a drone centrally (resolveDrone fallback owns it)`);
    assert.equal(profile.completionCue, undefined, `${id} should not re-list a completion cue centrally`);
  }
});
