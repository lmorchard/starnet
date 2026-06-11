// Tests for startRun's seed threading (#142). startRun touches DOM/Cytoscape,
// but every graph function guards on a null `cy` and addIceNode bails when the
// "cy" container is missing — so with a minimal document stub and an
// uninitialized graph, the real startRun runs end-to-end in node.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Stub the DOM before importing run-control's transitive graph deps. addIceNode
// calls document.getElementById("cy"); returning null makes it a no-op.
globalThis.document = globalThis.document ?? { getElementById: () => null };

const { startRun } = await import("./run-control.js");
const { getState } = await import("../core/state.js");
const { getSeed } = await import("../core/rng.js");
const { buildNetwork } = await import("../../data/networks/generated.js");

/** Stable snapshot of every node's vulnerabilities, keyed + sorted by node id. */
function vulnSnapshot() {
  const nodes = getState().nodes;
  return Object.keys(nodes)
    .sort()
    .map((id) => [id, nodes[id].vulnerabilities])
    .filter(([, v]) => v !== undefined);
}

describe("startRun — seed threading", () => {
  test("seeds the run-time RNG from networkResult.meta.seed", () => {
    const result = buildNetwork({ seed: "seed-A" });
    startRun(result);
    assert.equal(getSeed(), result.meta.seed);
  });

  test("same network produces identical vulnerabilities across launches", () => {
    const result = buildNetwork({ seed: "seed-repro" });

    startRun(result);
    const first = vulnSnapshot();

    startRun(result);
    const second = vulnSnapshot();

    assert.ok(first.length > 0, "expected at least one node with vulnerabilities");
    assert.deepEqual(second, first);
  });

  test("the seed drives vulnerability generation (same topology, different seed)", () => {
    // Reuse one topology so node ids are identical across both runs; vary only the
    // run-time seed. Any difference is therefore attributable to the seed, not to a
    // different graph — proves the threaded seed reaches vuln generation.
    const base = buildNetwork({ seed: "seed-topo" });

    startRun({ graphDef: base.graphDef, meta: { ...base.meta, seed: "vulns-A" } });
    const snapA = vulnSnapshot();

    startRun({ graphDef: base.graphDef, meta: { ...base.meta, seed: "vulns-B" } });
    const snapB = vulnSnapshot();

    assert.deepEqual(
      snapB.map(([id]) => id),
      snapA.map(([id]) => id),
      "expected identical node ids (same topology)",
    );
    assert.notDeepEqual(snapB, snapA);
  });

  test("absent meta.seed falls back to a random run- seed without crashing", () => {
    const result = buildNetwork({ seed: "seed-fallback" });
    delete result.meta.seed;

    assert.doesNotThrow(() => startRun(result));
    assert.match(getSeed(), /^run-/);
  });
});
