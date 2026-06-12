import { test } from "node:test";
import assert from "node:assert/strict";
import { findPath } from "./graph-path.js";

// Build a mock `cy` whose edges() yields objects with the same `.data()`
// surface findPath consumes. Edges are undirected pairs [source, target].
function mockCy(edges) {
  return {
    edges: () =>
      edges.map(([source, target]) => ({
        data: (key) => (key === "source" ? source : target),
      })),
  };
}

test("findPath returns the ordered node list including both endpoints", () => {
  // a — b — c — d
  const cy = mockCy([["a", "b"], ["b", "c"], ["c", "d"]]);
  assert.deepEqual(findPath(cy, "a", "d"), ["a", "b", "c", "d"]);
});

test("findPath traverses edges as undirected (target → source too)", () => {
  // edges stored as a→b, c→b — path a..c must walk c→b backwards
  const cy = mockCy([["a", "b"], ["c", "b"]]);
  assert.deepEqual(findPath(cy, "a", "c"), ["a", "b", "c"]);
});

test("findPath returns the shortest path when multiple exist", () => {
  // a—b—d and a—c—d both length 2; a—e—f—d is longer. BFS picks a length-2 path.
  const cy = mockCy([
    ["a", "b"], ["b", "d"],
    ["a", "c"], ["c", "d"],
    ["a", "e"], ["e", "f"], ["f", "d"],
  ]);
  const path = findPath(cy, "a", "d");
  assert.equal(path.length, 3);
  assert.equal(path[0], "a");
  assert.equal(path[2], "d");
});

test("findPath returns null when the target is unreachable", () => {
  const cy = mockCy([["a", "b"], ["c", "d"]]);
  assert.equal(findPath(cy, "a", "d"), null);
});

test("findPath returns null for a degenerate from === to (no traversable path)", () => {
  const cy = mockCy([["a", "b"]]);
  assert.equal(findPath(cy, "a", "a"), null);
});
