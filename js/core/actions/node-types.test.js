import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getNodeType,
  resolveNode,
  getBehaviors,
  hasBehavior,
  getStateFields,
  getActions,
  BEHAVIORS,
  NODE_TYPES,
} from "./node-types.js";

// ── helpers ───────────────────────────────────────────────

/** @param {string} type @param {string} grade */
function mockNode(type, grade = "C", extra = {}) {
  return { id: `${type}-1`, type, grade, accessLevel: "locked", eventForwardingDisabled: false, ...extra };
}

/** @param {number|null} traceSecondsRemaining */
function mockState(traceSecondsRemaining = null) {
  return /** @type {any} */ ({ traceSecondsRemaining });
}

// ── getNodeType ───────────────────────────────────────────

describe("getNodeType", () => {
  it("returns the base definition for a known type", () => {
    const def = getNodeType("ids");
    assert.ok(Array.isArray(def.behaviors));
    assert.ok(Array.isArray(def.actions));
  });

});

// ── resolveNode ───────────────────────────────────────────

describe("resolveNode", () => {
  it("returns base def when no grade override exists", () => {
    const node = mockNode("ids", "C");
    const resolved = resolveNode(node);
    assert.deepEqual(resolved.behaviors, ["detection"]);
  });

  it("appends extraBehaviors for Grade-S ids", () => {
    const node = mockNode("ids", "S");
    const resolved = resolveNode(node);
    assert.ok(resolved.behaviors.includes("detection"));
    assert.ok(resolved.behaviors.includes("direct-trace"));
  });

  it("appends extraBehaviors for Grade-A ids", () => {
    const node = mockNode("ids", "A");
    const resolved = resolveNode(node);
    assert.ok(resolved.behaviors.includes("direct-trace"));
  });

  it("does NOT add direct-trace for Grade-C ids", () => {
    const node = mockNode("ids", "C");
    const resolved = resolveNode(node);
    assert.ok(!resolved.behaviors.includes("direct-trace"));
  });

  it("does NOT add direct-trace for Grade-B ids", () => {
    const node = mockNode("ids", "B");
    const resolved = resolveNode(node);
    assert.ok(!resolved.behaviors.includes("direct-trace"));
  });

  it("returns base def for types with no gradeOverrides", () => {
    const node = mockNode("gateway", "S");
    const resolved = resolveNode(node);
    assert.deepEqual(resolved.behaviors, []);
  });
});

// ── hasBehavior ───────────────────────────────────────────

describe("hasBehavior", () => {
  it("returns true for detection on ids", () => {
    assert.ok(hasBehavior(mockNode("ids"), "detection"));
  });

  it("returns false for detection on gateway", () => {
    assert.ok(!hasBehavior(mockNode("gateway"), "detection"));
  });

  it("returns true for direct-trace on Grade-S ids", () => {
    assert.ok(hasBehavior(mockNode("ids", "S"), "direct-trace"));
  });

  it("returns false for direct-trace on Grade-C ids", () => {
    assert.ok(!hasBehavior(mockNode("ids", "C"), "direct-trace"));
  });

  it("returns true for monitor on security-monitor", () => {
    assert.ok(hasBehavior(mockNode("security-monitor"), "monitor"));
  });

  it("returns true for iceResident on security-monitor", () => {
    assert.ok(hasBehavior(mockNode("security-monitor"), "iceResident"));
  });

  it("returns true for lootable on fileserver", () => {
    assert.ok(hasBehavior(mockNode("fileserver"), "lootable"));
  });

  it("returns false for lootable on router", () => {
    assert.ok(!hasBehavior(mockNode("router"), "lootable"));
  });
});

// ── getStateFields ────────────────────────────────────────

describe("getStateFields", () => {
  it("returns eventForwardingDisabled for ids", () => {
    const fields = getStateFields(mockNode("ids"));
    assert.equal(fields.eventForwardingDisabled, false);
  });

  it("returns empty object for gateway", () => {
    const fields = getStateFields(mockNode("gateway"));
    assert.deepEqual(fields, {});
  });

  it("returns empty object for security-monitor", () => {
    const fields = getStateFields(mockNode("security-monitor"));
    assert.deepEqual(fields, {});
  });

  it("returns empty object for fileserver (lootable has no stateFields)", () => {
    const fields = getStateFields(mockNode("fileserver"));
    assert.deepEqual(fields, {});
  });
});

// ── getActions ────────────────────────────────────────────

describe("getActions", () => {
  it("returns reconfigure for compromised ids with forwarding enabled", () => {
    const node = mockNode("ids", "C", { accessLevel: "compromised", eventForwardingDisabled: false });
    const actions = getActions(node, mockState());
    assert.ok(actions.find((a) => a.id === "reconfigure"));
  });

  it("returns reconfigure for owned ids with forwarding enabled", () => {
    const node = mockNode("ids", "C", { accessLevel: "owned", eventForwardingDisabled: false });
    const actions = getActions(node, mockState());
    assert.ok(actions.find((a) => a.id === "reconfigure"));
  });

  it("does not return reconfigure for ids with forwarding disabled", () => {
    const node = mockNode("ids", "C", { accessLevel: "owned", eventForwardingDisabled: true });
    const actions = getActions(node, mockState());
    assert.ok(!actions.find((a) => a.id === "reconfigure"));
  });

  it("does not return reconfigure for locked ids", () => {
    const node = mockNode("ids", "C", { accessLevel: "locked" });
    const actions = getActions(node, mockState());
    assert.ok(!actions.find((a) => a.id === "reconfigure"));
  });

  it("returns cancel-trace for owned security-monitor with active trace", () => {
    const node = mockNode("security-monitor", "A", { accessLevel: "owned" });
    const actions = getActions(node, mockState(30));
    assert.ok(actions.find((a) => a.id === "cancel-trace"));
  });

  it("does not return cancel-trace for owned security-monitor with no trace", () => {
    const node = mockNode("security-monitor", "A", { accessLevel: "owned" });
    const actions = getActions(node, mockState(null));
    assert.ok(!actions.find((a) => a.id === "cancel-trace"));
  });

  it("does not return cancel-trace for locked security-monitor", () => {
    const node = mockNode("security-monitor", "A", { accessLevel: "locked" });
    const actions = getActions(node, mockState(30));
    assert.ok(!actions.find((a) => a.id === "cancel-trace"));
  });

  it("returns empty array for gateway", () => {
    const node = mockNode("gateway", "D", { accessLevel: "owned" });
    const actions = getActions(node, mockState(30));
    assert.deepEqual(actions, []);
  });

  it("cancel-trace desc includes seconds remaining", () => {
    const node = mockNode("security-monitor", "A", { accessLevel: "owned" });
    const actions = getActions(node, mockState(42));
    const action = actions.find((a) => a.id === "cancel-trace");
    assert.ok(action?.desc(node, mockState(42)).includes("42"));
  });
});

// ── getBehaviors ──────────────────────────────────────────

describe("getBehaviors", () => {
  it("returns atom objects for ids", () => {
    const atoms = getBehaviors(mockNode("ids", "C"));
    assert.equal(atoms.length, 1);
    assert.equal(atoms[0].id, "detection");
  });

  it("returns two atoms for Grade-S ids", () => {
    const atoms = getBehaviors(mockNode("ids", "S"));
    assert.equal(atoms.length, 2);
    assert.ok(atoms.find((a) => a.id === "detection"));
    assert.ok(atoms.find((a) => a.id === "direct-trace"));
  });

  it("all behavior IDs referenced in NODE_TYPES exist in BEHAVIORS", () => {
    for (const [typeName, def] of Object.entries(NODE_TYPES)) {
      for (const id of def.behaviors) {
        assert.ok(BEHAVIORS[id], `Type "${typeName}" references unknown behavior "${id}"`);
      }
      for (const [grade, override] of Object.entries(def.gradeOverrides ?? {})) {
        for (const id of (override.extraBehaviors ?? [])) {
          assert.ok(BEHAVIORS[id], `Type "${typeName}" grade ${grade} references unknown behavior "${id}"`);
        }
      }
    }
  });

  it("returns empty for gateway", () => {
    const atoms = getBehaviors(mockNode("gateway"));
    assert.deepEqual(atoms, []);
  });
});
