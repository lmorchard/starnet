// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Importing these modules registers atoms as a side effect.
import "./effects.js";
import "./triggers.js";

import { getEffect, getTrigger } from "./atoms.js";

// ── Live effect atoms ─────────────────────────────────────

describe("atom: raise-alert", () => {
  it("registered with id and empty schema", () => {
    const atom = getEffect("raise-alert");
    assert.ok(atom);
    assert.equal(atom.id, "raise-alert");
    assert.deepEqual(atom.schema, {});
  });

  it("apply() invokes propagateAlertEvent with the instance's attentionNodeId", () => {
    const atom = getEffect("raise-alert");
    const calls = [];
    const ctx = { propagateAlertEvent: (nodeId) => calls.push(nodeId) };
    const instance = { id: "ice-1", hostNodeId: "host-1", attentionNodeId: "host-1" };
    atom.apply(instance, {}, ctx);
    assert.deepEqual(calls, ["host-1"]);
  });
});

describe("atom: damage-health", () => {
  it("registered with id and amount-only schema", () => {
    const atom = getEffect("damage-health");
    assert.ok(atom);
    assert.equal(atom.id, "damage-health");
    assert.equal(atom.schema.amount, "number");
  });

  it("apply() calls ctx.damagePlayerHealth with params.amount", () => {
    const atom = getEffect("damage-health");
    const calls = [];
    const ctx = { damagePlayerHealth: (n) => calls.push(n) };
    atom.apply({}, {}, ctx, { amount: 15 });
    assert.deepEqual(calls, [15]);
  });
});

describe("atom: damage-deck", () => {
  it("registered with id and amount-only schema", () => {
    const atom = getEffect("damage-deck");
    assert.ok(atom);
    assert.equal(atom.id, "damage-deck");
    assert.equal(atom.schema.amount, "number");
  });

  it("apply() calls ctx.damagePlayerDeck with params.amount", () => {
    const atom = getEffect("damage-deck");
    const calls = [];
    const ctx = { damagePlayerDeck: (n) => calls.push(n) };
    atom.apply({}, {}, ctx, { amount: 8 });
    assert.deepEqual(calls, [8]);
  });
});

// ── Dormant effect atoms ──────────────────────────────────

describe("dormant effect atoms: registered with id + schema, apply() throws", () => {
  const dormantIds = [
    "start-trace", "steal-cash", "destroy-macguffin", "relocate-macguffin",
    "shred-card", "degrade-card", "steal-card", "lock-node", "patch-vulns",
    "force-reboot", "deselect-player", "cancel-action", "accelerate",
    "broadcast-alert-adjacent",
  ];
  for (const id of dormantIds) {
    it(`${id}: registered, apply throws`, () => {
      const atom = getEffect(id);
      assert.ok(atom, `${id} must be registered`);
      assert.equal(atom.id, id);
      assert.ok(atom.schema, `${id} must have a schema`);
      assert.throws(() => atom.apply({}, {}, {}, {}), /not yet implemented/);
    });
  }
});

// ── Live trigger atom ─────────────────────────────────────

describe("trigger: on-dwell-grade", () => {
  it("registered and calls ctx.hasDwellExpired with the instance", () => {
    const t = getTrigger("on-dwell-grade");
    assert.ok(t);
    let received;
    const ctx = { hasDwellExpired: (i) => { received = i; return true; } };
    const instance = { id: "x", attentionNodeId: "a" };
    assert.equal(t.test(instance, {}, ctx), true);
    assert.deepEqual(received, instance);
  });
});

// ── Dormant trigger atoms ─────────────────────────────────

describe("dormant trigger atoms: registered with id + schema, test() throws", () => {
  const dormantIds = [
    "on-select", "on-probe", "on-exploit", "on-exploit-fail",
    "on-dump", "on-fetch", "on-dwell-N-ticks", "on-detect-presence",
  ];
  for (const id of dormantIds) {
    it(`${id}: registered, test throws`, () => {
      const t = getTrigger(id);
      assert.ok(t, `${id} must be registered`);
      assert.equal(t.id, id);
      assert.ok(t.schema, `${id} must have a schema`);
      assert.throws(() => t.test({}, {}, {}), /not yet implemented/);
    });
  }
});
