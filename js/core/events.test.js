// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { E } from "./events.js";

describe("events — E catalog", () => {
  it("exposes new ICE reinvention event constants", () => {
    assert.equal(E.ICE_INSTALLED,        "ice:installed");
    assert.equal(E.ICE_REVEALED,         "ice:revealed");
    assert.equal(E.ICE_ACTIVATED,        "ice:activated");
    assert.equal(E.ICE_EFFECT_APPLIED,   "ice:effect-applied");
    assert.equal(E.ICE_HACKED,           "ice:hacked");
    assert.equal(E.ICE_STASH_DEPOSITED,  "ice:stash-deposited");
  });
});
