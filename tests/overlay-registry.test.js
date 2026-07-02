import { test } from "node:test";
import assert from "node:assert/strict";
import { OVERLAY_DESCRIPTORS, overlayDescriptorForAction, descriptorForName } from "../js/ui/overlays/registry.js";
import { ACTION_FEEDBACK_PROFILES, DEFAULT_PROFILE } from "../js/ui/feedback-profiles.js";
import { A } from "../js/core/action-ids.js";

test("registry has eight overlays", () => {
  assert.equal(OVERLAY_DESCRIPTORS.length, 8);
});

test("action-feedback overlays keyed to a specific action map 1:1 to the timed/cooldown actions", () => {
  // Excludes "generic-process" (#187 Phase 4b) — like ice-detect, it's action-agnostic
  // (action: null) even though its driver is "action-feedback".
  const af = OVERLAY_DESCRIPTORS.filter((d) => d.driver === "action-feedback" && d.action !== null);
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

// #187 Phase 4b — generic-process is the action-agnostic action-feedback fallback, analogous to
// ice-detect being the action-agnostic ice-timer sibling.
test("generic-process is the lone action-agnostic action-feedback sibling", () => {
  const generic = OVERLAY_DESCRIPTORS.filter((d) => d.driver === "action-feedback" && d.action === null);
  assert.equal(generic.length, 1);
  assert.equal(generic[0].key, "generic");
  assert.equal(generic[0].name, "generic-process");
});

test("overlayDescriptorForAction resolves and rejects correctly", () => {
  assert.equal(overlayDescriptorForAction(A.PROBE)?.key, "probe");
  assert.equal(overlayDescriptorForAction(A.MINE)?.key, "mine");
});

// #187 Phase 4b — an action with no central override now resolves the registered
// "generic-process" default overlay instead of null (Phase 3 left this a safe no-op).
test("an action with no central feedback override resolves the generic-process default overlay", () => {
  assert.equal(overlayDescriptorForAction(A.JACKOUT)?.name, "generic-process");
  assert.equal(overlayDescriptorForAction("nonsense")?.name, "generic-process");
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
  assert.equal(descriptorForName("generic-process")?.key, "generic", "#187 Phase 4b registers the default overlay");
  assert.equal(descriptorForName("nonsense"), null);
});

test("every core verb's central feedback profile names a real registered overlay", () => {
  for (const [actionId, profile] of Object.entries(ACTION_FEEDBACK_PROFILES)) {
    assert.ok(descriptorForName(profile.overlay), `${actionId}'s central overlay "${profile.overlay}" should resolve to a real descriptor`);
  }
});

// #187 Phase 4b — DEFAULT_PROFILE.overlay now maps to a real, mountable element (not a no-op).
test("DEFAULT_PROFILE.overlay resolves to a real registered descriptor", () => {
  const d = descriptorForName(DEFAULT_PROFILE.overlay);
  assert.ok(d, "DEFAULT_PROFILE.overlay should resolve to a registered descriptor");
  assert.equal(d.name, "generic-process");
});
