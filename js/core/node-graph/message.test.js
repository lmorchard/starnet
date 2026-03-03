import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMessage, appendPath, hasCycle } from "./message.js";

describe("createMessage", () => {
  it("sets type, origin, payload, and path", () => {
    const msg = createMessage({ type: "alert", origin: "ids-1", payload: { level: 1 } });
    assert.equal(msg.type, "alert");
    assert.equal(msg.origin, "ids-1");
    assert.deepEqual(msg.path, ["ids-1"]);
    assert.deepEqual(msg.payload, { level: 1 });
    assert.equal(msg.destinations, null);
  });

  it("defaults payload to empty object", () => {
    const msg = createMessage({ type: "signal", origin: "A" });
    assert.deepEqual(msg.payload, {});
  });

  it("accepts destinations array", () => {
    const msg = createMessage({ type: "signal", origin: "A", destinations: ["B", "C"] });
    assert.deepEqual(msg.destinations, ["B", "C"]);
  });
});

describe("appendPath", () => {
  it("returns a new message with nodeId appended to path", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const msg2 = appendPath(msg, "B");
    assert.deepEqual(msg2.path, ["A", "B"]);
    // original unchanged
    assert.deepEqual(msg.path, ["A"]);
  });

  it("preserves all other fields", () => {
    const msg = createMessage({ type: "signal", origin: "A", payload: { active: true } });
    const msg2 = appendPath(msg, "B");
    assert.equal(msg2.type, "signal");
    assert.equal(msg2.origin, "A");
    assert.deepEqual(msg2.payload, { active: true });
  });
});

describe("hasCycle", () => {
  it("returns false when nodeId not in path", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    assert.equal(hasCycle(msg, "B"), false);
  });

  it("returns true when nodeId is the origin (already in path)", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    assert.equal(hasCycle(msg, "A"), true);
  });

  it("returns true when nodeId appears later in path", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const msg2 = appendPath(msg, "B");
    const msg3 = appendPath(msg2, "C");
    assert.equal(hasCycle(msg3, "B"), true);
    assert.equal(hasCycle(msg3, "A"), true);
  });
});
