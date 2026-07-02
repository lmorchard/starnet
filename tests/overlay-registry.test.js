import { test } from "node:test";
import assert from "node:assert/strict";
import { OVERLAY_DESCRIPTORS, overlayDescriptorForAction, descriptorForName } from "../js/ui/overlays/registry.js";
import { ACTION_FEEDBACK_PROFILES } from "../js/ui/feedback-profiles.js";
import { A } from "../js/core/action-ids.js";

test("registry has seven overlays", () => {
  assert.equal(OVERLAY_DESCRIPTORS.length, 7);
});

test("action-feedback overlays map 1:1 to the timed/cooldown actions", () => {
  const af = OVERLAY_DESCRIPTORS.filter((d) => d.driver === "action-feedback");
  const actions = af.map((d) => d.action).sort();
  assert.deepEqual(actions, [A.PROBE, A.XPLOIT, A.DUMP, A.FETCH, A.MINE, A.LIE_LOW].sort());
  assert.equal(new Set(actions).size, actions.length, "no duplicate action mappings");
});

test("ice-detect is the lone timer-driven sibling", () => {
  const ice = OVERLAY_DESCRIPTORS.filter((d) => d.driver === "ice-timer");
  assert.equal(ice.length, 1);
  assert.equal(ice[0].key, "ice");
  assert.equal(ice[0].action, null);
});

test("overlayDescriptorForAction resolves and rejects correctly", () => {
  assert.equal(overlayDescriptorForAction(A.PROBE)?.key, "probe");
  assert.equal(overlayDescriptorForAction(A.MINE)?.key, "mine");
  assert.equal(overlayDescriptorForAction(A.JACKOUT), null);
  assert.equal(overlayDescriptorForAction("nonsense"), null);
});

test("every descriptor is well-formed", () => {
  for (const d of OVERLAY_DESCRIPTORS) {
    assert.match(d.tag, /-overlay$/);
    assert.ok(d.label && typeof d.label === "string");
    assert.ok(d.demo?.type && d.demo?.grade);
    assert.ok(d.name && typeof d.name === "string");
  }
});

// #187 Phase 3 — name-keyed overlay resolution.
test("every descriptor has a unique name", () => {
  const names = OVERLAY_DESCRIPTORS.map((d) => d.name);
  assert.equal(new Set(names).size, names.length, "no duplicate overlay names");
});

test("descriptorForName resolves a registered name and rejects an unregistered one", () => {
  assert.equal(descriptorForName("probe-sweep")?.key, "probe");
  assert.equal(descriptorForName("generic-process"), null, "Phase 4 has not registered the default overlay yet");
  assert.equal(descriptorForName("nonsense"), null);
});

test("every core verb's central feedback profile names a real registered overlay", () => {
  for (const [actionId, profile] of Object.entries(ACTION_FEEDBACK_PROFILES)) {
    assert.ok(descriptorForName(profile.overlay), `${actionId}'s central overlay "${profile.overlay}" should resolve to a real descriptor`);
  }
});
