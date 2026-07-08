import test from "node:test";
import assert from "node:assert/strict";
import { mineStrategy } from "../scripts/bot/heuristics/mine.js";
import { puzzleStrategy, resetPuzzleTracking } from "../scripts/bot/heuristics/puzzles.js";
import { A } from "../js/core/action-ids.js";

function world(over = {}) {
  return {
    needsExploit: ["target"], minable: [{ nodeId: "owned-1", vulnTypes: new Set(["weak-auth"]) }],
    hoardUsable: 0, failedNodes: new Set(),
    nodes: new Map([["target", { vulnerabilities: [{ id: "weak-auth" }] }]]),
    ...over,
  };
}
test("proposes mine when hoard is low and a minable node exists", () => {
  const p = mineStrategy(world());
  assert.equal(p.length, 1); assert.equal(p[0].action, A.MINE); assert.equal(p[0].nodeId, "owned-1");
});
test("prefers a minable node whose vulns overlap a blocked vuln", () => {
  const w = world({ minable: [
    { nodeId: "other", vulnTypes: new Set(["snmp-public"]) },
    { nodeId: "match", vulnTypes: new Set(["weak-auth"]) },
  ]});
  assert.equal(mineStrategy(w)[0].nodeId, "match");
});
test("no proposal when the hoard already has plenty of usable rounds", () => {
  const w = world({ hoardUsable: 12 });
  assert.equal(mineStrategy(w).length, 0);
});
test("no proposal when nothing is minable (all exhausted)", () => {
  assert.equal(mineStrategy(world({ minable: [] })).length, 0);
});

// mine must be owned by mineStrategy, not swept up by the generic puzzle heuristic
// (which proposes unknown owned-node actions proactively at a higher score).
test("puzzleStrategy ignores the mine action", () => {
  resetPuzzleTracking();
  const w = {
    owned: ["owned-1"],
    availableActions: new Map([["owned-1", [{ id: A.MINE, label: "MINE" }]]]),
  };
  const p = puzzleStrategy(w);
  assert.equal(p.filter((x) => x.action === A.MINE).length, 0);
});
