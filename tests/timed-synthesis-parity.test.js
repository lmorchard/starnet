// @ts-check
// #288 A1: after migrating the clean core verbs onto declarative `timed:` blocks,
// the synthesized timed-action operator must be byte-equivalent to the config the
// traits used to hand-write — same action, activeAttr (from the registry), and
// durationTable. Guards the arm-vs-work inversion and the activeAttr resolution.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createFileserver, createCryptovault } from "../js/core/node-graph/node-factories.js";
import { NodeGraph } from "../js/core/node-graph/runtime.js";
import { mockCtx } from "../js/core/node-graph/ctx.js";
import { getTrait } from "../js/core/node-graph/traits.js";

/** Expected (action → { activeAttr, durationTable }) the hand-wired operators used. */
const EXPECTED = {
  probe: { activeAttr: "probing", durationTable: { S: 50, A: 40, B: 30, C: 20, D: 20, F: 10 } },
  mine:  { activeAttr: "mining",  durationTable: { S: 70, A: 60, B: 50, C: 40, D: 35, F: 30 } },
  dump:  { activeAttr: "reading", durationTable: { S: 40, A: 35, B: 25, C: 15, D: 15, F: 8 } },
  fetch: { activeAttr: "looting", durationTable: { S: 30, A: 25, B: 20, C: 12, D: 10, F: 6 } },
};

function opFor(nodeDef, action) {
  const g = new NodeGraph({ nodes: [nodeDef], edges: [] }, mockCtx());
  const built = g.getNodeState(nodeDef.id); // use whatever the codebase exposes; see runtime.js
  // Prefer a public operator accessor if one exists; otherwise read the constructed node.
  const node = g._nodes.get(nodeDef.id);
  return node.operators.find((o) => o.name === "timed-action" && o.action === action);
}

describe("core-verb synthesis parity (#288 A1)", () => {
  it("fileserver synthesizes probe/dump/fetch/mine with the registry activeAttr + trait durationTable", () => {
    const nodeDef = createFileserver("fs1", { grade: "B" });
    for (const action of ["probe", "dump", "fetch", "mine"]) {
      const op = opFor(nodeDef, action);
      assert.ok(op, `synthesized timed-action operator for ${action} exists`);
      assert.equal(op.activeAttr, EXPECTED[action].activeAttr, `${action} activeAttr`);
      assert.deepEqual(op.durationTable, EXPECTED[action].durationTable, `${action} durationTable`);
      assert.deepEqual(op.onComplete?.[0]?.effect, "ctx-call", `${action} onComplete is a ctx-call`);
    }
  });

  it("hackable trait no longer hand-wires probe/mine timed-action operators", () => {
    const hackableOps = getTrait("hackable").operators;
    const timedActions = hackableOps
      .filter((o) => o.name === "timed-action")
      .map((o) => o.action);
    assert.deepEqual(
      timedActions,
      [],
      "hackable should declare no timed-action operators (probe/mine are synthesized)",
    );
    assert.ok(
      hackableOps.some((o) => o.name === "sweep-cascade"),
      "hackable should still declare sweep-cascade (untouched by #288 A1)",
    );
  });

  it("lootable trait no longer hand-wires dump/fetch timed-action operators", () => {
    const lootableOps = getTrait("lootable").operators;
    const timedActions = lootableOps.filter((o) => o.name === "timed-action");
    assert.deepEqual(
      timedActions,
      [],
      "lootable should declare no timed-action operators at all (dump/fetch are synthesized)",
    );
  });
});
