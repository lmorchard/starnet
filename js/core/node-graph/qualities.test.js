import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { QualityStore } from "./qualities.js";

describe("QualityStore", () => {
  it("returns 0 for unknown names", () => {
    const q = new QualityStore();
    assert.equal(q.get("unknown"), 0);
  });

  it("set and get round-trip correctly", () => {
    const q = new QualityStore();
    q.set("tokens", 5);
    assert.equal(q.get("tokens"), 5);
  });

  it("accepts initial values", () => {
    const q = new QualityStore({ panels: 3 });
    assert.equal(q.get("panels"), 3);
  });

  it("delta increments", () => {
    const q = new QualityStore();
    q.delta("score", 10);
    q.delta("score", 5);
    assert.equal(q.get("score"), 15);
  });

  it("delta decrements", () => {
    const q = new QualityStore({ hp: 10 });
    q.delta("hp", -3);
    assert.equal(q.get("hp"), 7);
  });

  it("snapshot returns a copy, not a live reference", () => {
    const q = new QualityStore({ x: 1 });
    const snap = q.snapshot();
    snap.x = 99;
    assert.equal(q.get("x"), 1);
  });

  it("restore replaces all values", () => {
    const q = new QualityStore({ a: 1 });
    q.restore({ b: 2, c: 3 });
    assert.equal(q.get("a"), 0);
    assert.equal(q.get("b"), 2);
    assert.equal(q.get("c"), 3);
  });
});
