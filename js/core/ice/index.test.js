// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Importing the public surface MUST register the atom bodies as a side effect.
import { getEffect, getTrigger, getType } from "./index.js";

describe("ice/index registers atoms + types on import", () => {
  it("damage-health / damage-deck / raise-alert atoms are live", () => {
    assert.ok(getEffect("damage-health"), "damage-health must be registered");
    assert.ok(getEffect("damage-deck"), "damage-deck must be registered");
    assert.ok(getEffect("raise-alert"), "raise-alert must be registered");
  });

  it("on-dwell-grade trigger is live", () => {
    assert.ok(getTrigger("on-dwell-grade"), "on-dwell-grade must be registered");
  });

  it("classic presets are registered", () => {
    // Spot-check: registry.js self-registers a classic preset per grade on import.
    assert.ok(getType("patrol-classic-B"), "patrol-classic-B must be registered");
  });
});
