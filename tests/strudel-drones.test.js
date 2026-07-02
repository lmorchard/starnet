import { test } from "node:test";
import assert from "node:assert/strict";
import { DRONES, DRONE_IDS, resolveDrone, resolveActionDrone } from "../js/audio/strudel/data/drones.js";
import { noteToFreq, droneRange } from "../js/audio/strudel/drones.js";
import { DEFAULT_PROFILE, ACTION_FEEDBACK_PROFILES } from "../js/ui/feedback-profiles.js";
import { A } from "../js/core/action-ids.js";

test("resolveDrone maps the 7 timed actions to themselves, unknown → null", () => {
  for (const id of ["probe", "xploit", "dump", "fetch", "mine", "lie-low", "reboot"]) {
    assert.equal(resolveDrone(id), id);
  }
  assert.equal(resolveDrone("nope"), null);
  assert.equal(resolveDrone(""), null);
  assert.equal(resolveDrone(undefined), null);
});

test("DRONE_IDS covers exactly the 7 timed actions plus the generic default (#187 Phase 4b)", () => {
  assert.deepEqual([...DRONE_IDS].sort(), ["dump", "fetch", "generic", "lie-low", "mine", "probe", "reboot", "xploit"]);
});

test("noteToFreq converts note names to Hz", () => {
  assert.ok(Math.abs(noteToFreq("A4") - 440) < 0.01);
  assert.ok(Math.abs(noteToFreq("A2") - 110) < 0.01);
  assert.ok(Math.abs(noteToFreq("A1") - 55) < 0.01);
  assert.ok(Math.abs(noteToFreq("C2") - 65.41) < 0.1);
  assert.ok(Math.abs(noteToFreq("E2") - 82.41) < 0.1);
});

test("droneRange interpolates {from,to} by progress and passes numbers through", () => {
  assert.equal(droneRange({ from: 300, to: 1500 }, 0), 300);
  assert.equal(droneRange({ from: 300, to: 1500 }, 1), 1500);
  assert.equal(droneRange({ from: 300, to: 1500 }, 0.5), 900);
  assert.equal(droneRange({ from: 0, to: 10 }, 2), 10); // clamps p>1
  assert.equal(droneRange(600, 0.5), 600); // plain number
});

test("amp-LFO drones do not also declare a progress-driven gain (engine constraint)", () => {
  // The two are mutually exclusive — the amp LFO owns ampGain.gain.
  for (const [id, spec] of Object.entries(DRONES)) {
    if (spec.lfo && (spec.lfo.target ?? "amp") === "amp") {
      assert.ok(!(spec.gain && typeof spec.gain === "object"),
        `${id}: amp-LFO drone must not have a {from,to} gain`);
    }
  }
});

// #187 Phase 3 — resolveActionDrone layers inline → central → resolveDrone() (legacy, preserved
// as-is) → DEFAULT_PROFILE.drone. Every core verb's bespoke drone must resolve exactly as
// resolveDrone() alone already resolved it — zero regression, zero re-enumeration.
test("resolveActionDrone preserves every core verb's bespoke drone via the resolveDrone fallback", () => {
  for (const id of ["probe", "xploit", "dump", "fetch", "mine", "lie-low", "reboot"]) {
    assert.equal(resolveActionDrone(id), resolveDrone(id), `${id} should resolve identically to legacy resolveDrone()`);
  }
});

test("resolveActionDrone falls to DEFAULT_PROFILE.drone for an action resolveDrone doesn't know", () => {
  assert.equal(resolveActionDrone("crack-vault"), DEFAULT_PROFILE.drone);
});

// #187 Phase 4b — the generic drone spec is real (feel-DRAFT) audio, not a silent no-op.
test("the DEFAULT drone spec is registered and well-formed", () => {
  const spec = DRONES[DEFAULT_PROFILE.drone];
  assert.ok(spec, "the generic drone spec should be registered as of Phase 4b");
  assert.ok(["sawtooth", "sine", "square", "triangle", "noise", "fm", "dual"].includes(spec.source));
  assert.equal(typeof spec.volume, "number");
  assert.equal(typeof spec.fade, "number");
});

test("resolveActionDrone: inline wins over central and the resolveDrone fallback", () => {
  assert.equal(resolveActionDrone(A.PROBE, { drone: "custom" }), "custom");
});

test("resolveActionDrone: a central drone override (if one existed) would win over resolveDrone", () => {
  // No core verb centrally lists a drone today (by design — resolveDrone() already preserves it,
  // see feedback-profiles.js's module doc). Temporarily inject one to prove the ordering.
  const original = ACTION_FEEDBACK_PROFILES[A.PROBE];
  ACTION_FEEDBACK_PROFILES[A.PROBE] = { ...original, drone: "central-override" };
  try {
    assert.equal(resolveActionDrone(A.PROBE), "central-override");
  } finally {
    ACTION_FEEDBACK_PROFILES[A.PROBE] = original;
  }
});
