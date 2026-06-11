// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { disguiseTrapNodes, DISGUISE_TYPES } from "./disguise.js";
import { makeSeededRng } from "../rng.js";

function trapNode(id) {
  return { id, type: "honey-pot", attributes: { label: `pot/${id}`, trap: true } };
}
function plainNode(id, type) {
  return { id, type, attributes: { label: id } };
}

describe("disguiseTrapNodes", () => {
  it("rewrites a trap node's type to a loot-bearing disguise", () => {
    const nodes = [trapNode("honey-pot")];
    disguiseTrapNodes(nodes, makeSeededRng("seed-a"));
    assert.ok(DISGUISE_TYPES.includes(nodes[0].type), "type should be a disguise");
    assert.notEqual(nodes[0].type, "honey-pot", "real type must be hidden");
  });

  it("rewrites the label so it no longer reads as a honey-pot", () => {
    const nodes = [trapNode("honey-pot")];
    disguiseTrapNodes(nodes, makeSeededRng("seed-a"));
    assert.ok(!/honey/i.test(nodes[0].attributes.label), "label must not say honey");
  });

  it("leaves non-trap nodes untouched", () => {
    const nodes = [plainNode("fileserver", "fileserver")];
    const before = JSON.stringify(nodes[0]);
    disguiseTrapNodes(nodes, makeSeededRng("seed-a"));
    assert.equal(JSON.stringify(nodes[0]), before);
  });

  it("is deterministic for a given seed", () => {
    const a = [trapNode("honey-pot")];
    const b = [trapNode("honey-pot")];
    disguiseTrapNodes(a, makeSeededRng("seed-x"));
    disguiseTrapNodes(b, makeSeededRng("seed-x"));
    assert.equal(a[0].type, b[0].type);
    assert.equal(a[0].attributes.label, b[0].attributes.label);
  });

  it("never touches the node id", () => {
    const nodes = [trapNode("honey-pot")];
    disguiseTrapNodes(nodes, makeSeededRng("seed-a"));
    assert.equal(nodes[0].id, "honey-pot");
  });
});
