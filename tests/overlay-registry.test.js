import { test } from "node:test";
import assert from "node:assert/strict";
import { OVERLAY_DESCRIPTORS, overlayDescriptorForAction } from "../js/ui/overlays/registry.js";
import { A } from "../js/core/action-ids.js";

test("registry has six overlays", () => {
  assert.equal(OVERLAY_DESCRIPTORS.length, 6);
});

test("action-feedback overlays map 1:1 to the five timed actions", () => {
  const af = OVERLAY_DESCRIPTORS.filter((d) => d.driver === "action-feedback");
  const actions = af.map((d) => d.action).sort();
  assert.deepEqual(actions, [A.PROBE, A.XPLOIT, A.DUMP, A.FETCH, A.MINE].sort());
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
  }
});
