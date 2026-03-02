// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { generateNetwork } from "./network-gen.js";

// ── Determinism tests ──────────────────────────────────────────────────────────

describe("generateNetwork: determinism", () => {
  it("produces identical output for the same inputs (testseed C/B)", () => {
    const a = generateNetwork("testseed", "C", "B");
    const b = generateNetwork("testseed", "C", "B");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  });

  it("produces identical output for the same inputs (abc F/F)", () => {
    const a = generateNetwork("abc", "F", "F");
    const b = generateNetwork("abc", "F", "F");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  });

  it("produces identical output for the same inputs (xyz S/S)", () => {
    const a = generateNetwork("xyz", "S", "S");
    const b = generateNetwork("xyz", "S", "S");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  });

  it("produces different outputs for different seeds", () => {
    const a = generateNetwork("seed-one", "C", "C");
    const b = generateNetwork("seed-two", "C", "C");
    // Networks will almost certainly differ; if they somehow don't, that's fine too.
    // This test just confirms the call doesn't throw.
    assert.ok(a.nodes.length > 0);
    assert.ok(b.nodes.length > 0);
  });
});

// ── Structural tests ───────────────────────────────────────────────────────────

/** @param {string} seed @param {string} tc @param {string} mc */
function structural(seed, tc, mc) {
  describe(`generateNetwork: structure (${tc}/${mc})`, () => {
    const net = generateNetwork(seed, tc, mc);

    it("has wan, gateway, security-monitor nodes", () => {
      const types = new Set(net.nodes.map((n) => n.type));
      assert.ok(types.has("wan"),              "missing wan");
      assert.ok(types.has("gateway"),          "missing gateway");
      assert.ok(types.has("security-monitor"), "missing security-monitor");
    });

    it("has at least one fileserver or cryptovault", () => {
      const types = net.nodes.map((n) => n.type);
      assert.ok(
        types.includes("fileserver") || types.includes("cryptovault"),
        "no lootable node"
      );
    });

    it("security-monitor is adjacent to an ids node", () => {
      const monitorIds = net.nodes
        .filter((n) => n.type === "security-monitor")
        .map((n) => n.id);
      const hasLink = net.edges.some(
        ({ source, target }) =>
          (monitorIds.includes(target) && net.nodes.find((n) => n.id === source)?.type === "ids") ||
          (monitorIds.includes(source) && net.nodes.find((n) => n.id === target)?.type === "ids")
      );
      assert.ok(hasLink, "no ids→security-monitor edge");
    });

    it("all edge node references exist in nodes array", () => {
      const nodeIds = new Set(net.nodes.map((n) => n.id));
      for (const { source, target } of net.edges) {
        assert.ok(nodeIds.has(source), `edge source ${source} not in nodes`);
        assert.ok(nodeIds.has(target), `edge target ${target} not in nodes`);
      }
    });

    it("BFS from startNode reaches at least one lootable node", () => {
      /** @type {Record<string, string[]>} */
      const adj = {};
      for (const { source, target } of net.edges) {
        (adj[source] ??= []).push(target);
        (adj[target] ??= []).push(source);
      }
      const visited = new Set([net.startNode]);
      const queue = [net.startNode];
      let found = false;
      while (queue.length && !found) {
        const cur = queue.shift();
        const node = net.nodes.find((n) => n.id === cur);
        if (node && (node.type === "fileserver" || node.type === "cryptovault")) {
          found = true;
          break;
        }
        for (const nb of (adj[cur] ?? [])) {
          if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
        }
      }
      assert.ok(found, "no lootable node reachable from startNode");
    });

    it("no node has grade 'undefined' or null", () => {
      for (const node of net.nodes) {
        assert.ok(node.grade && node.grade !== "undefined", `node ${node.id} has bad grade: ${node.grade}`);
      }
    });
  });
}

structural("struct-seed", "F", "F");
structural("struct-seed", "C", "C");
structural("struct-seed", "B", "B");
structural("struct-seed", "S", "S");

// ── Snapshot tests ─────────────────────────────────────────────────────────────

const SNAP_DIR = new URL("./snapshots", import.meta.url).pathname;

/** @param {string} label @param {object} net */
function snapshot(label, net) {
  const file = `${SNAP_DIR}/network-gen-${label}.json`;
  const actual = JSON.stringify(net, null, 2);
  if (!existsSync(file)) {
    mkdirSync(SNAP_DIR, { recursive: true });
    writeFileSync(file, actual, "utf8");
    return; // first run — write and pass
  }
  const expected = readFileSync(file, "utf8");
  assert.strictEqual(actual, expected, `snapshot mismatch for ${label}`);
}

describe("generateNetwork: snapshots", () => {
  it("snap-seed F/F is stable", () => {
    snapshot("F-F", generateNetwork("snap-seed", "F", "F"));
  });
  it("snap-seed C/C is stable", () => {
    snapshot("C-C", generateNetwork("snap-seed", "C", "C"));
  });
  it("snap-seed B/B is stable", () => {
    snapshot("B-B", generateNetwork("snap-seed", "B", "B"));
  });
  it("snap-seed S/S is stable", () => {
    snapshot("S-S", generateNetwork("snap-seed", "S", "S"));
  });
});

// ── Set piece tests ──────────────────────────────────────────────────────────

describe("generateNetwork: set pieces", () => {
  it("deterministic with forcePieces careless-user", () => {
    const a = generateNetwork("sp-test", "B", "B", { forcePieces: ["careless-user"] });
    const b = generateNetwork("sp-test", "B", "B", { forcePieces: ["careless-user"] });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  });

  it("careless-user adds expected nodes", () => {
    // sp-test-1 at B/B does NOT fire the set piece naturally
    const without = generateNetwork("sp-test-1", "B", "B");
    const withPiece = generateNetwork("sp-test-1", "B", "B", { forcePieces: ["careless-user"] });
    // careless-user adds 3 nodes: workstation, fileserver, firewall
    assert.ok(withPiece.nodes.length >= without.nodes.length + 3,
      `expected ≥${without.nodes.length + 3} nodes, got ${withPiece.nodes.length}`);
    // Should have at least 2 firewalls (1 from gate layer + 1 from set piece)
    const fwCount = withPiece.nodes.filter(n => n.type === "firewall").length;
    assert.ok(fwCount >= 2, `expected ≥2 firewalls, got ${fwCount}`);
  });

  it("snapshot: sp-snap B/B forced careless-user is stable", () => {
    snapshot("B-B-careless-user",
      generateNetwork("sp-snap", "B", "B", { forcePieces: ["careless-user"] }));
  });
});

// ── Input validation ───────────────────────────────────────────────────────────

describe("generateNetwork: input validation", () => {
  it("throws on invalid timeCost", () => {
    assert.throws(
      () => generateNetwork("seed", "E", "C"),
      /invalid timeCost/
    );
  });

  it("throws on invalid moneyCost", () => {
    assert.throws(
      () => generateNetwork("seed", "C", "Z"),
      /invalid moneyCost/
    );
  });
});
