// @ts-check
// Tests for js/core/profile/index.js — addGear, hasGear, gear field in createProfile.
// Includes v2→v3 migration test (normalizeProfile in profile-store.js).
// Written TDD-first (RED before implementation).

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Stub localStorage before importing profile-store (it reaches localStorage at module level via loadProfile)
const _store = new Map();
globalThis.document = globalThis.document ?? { getElementById: () => null };
globalThis.localStorage = globalThis.localStorage ?? {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k),
};

import {
  createProfile,
  addGear,
  hasGear,
  PROFILE_VERSION,
} from "../js/core/profile/index.js";

// Import normalizeProfile via profile-store (it's the migration seam).
// We import loadProfile + saveProfile to exercise the v2→v3 migration path.
const { loadProfile, saveProfile } = await import("../js/ui/profile-store.js");

const PROFILE_KEY = "starnet:profile";

describe("createProfile — gear field", () => {
  it("createProfile() includes gear: [] by default", () => {
    const p = createProfile();
    assert.ok(Array.isArray(p.gear), "gear must be an array");
    assert.equal(p.gear.length, 0, "gear must be empty by default");
  });

  it("createProfile preserves bank and hoard alongside gear", () => {
    const round = { id: "aa", rarity: "common", types: ["card"], disclosed: false };
    const p = createProfile({ bank: 500, hoard: [round] });
    assert.equal(p.bank, 500);
    assert.equal(p.hoard.length, 1);
    assert.deepEqual(p.gear, []);
  });

  it("PROFILE_VERSION is 3", () => {
    assert.equal(PROFILE_VERSION, 3);
  });
});

describe("addGear / hasGear", () => {
  it("addGear adds a known id and returns true", () => {
    const p = createProfile();
    const result = addGear(p, "analyzer");
    assert.equal(result, true, "addGear should return true when adding a known gear");
    assert.ok(p.gear.includes("analyzer"));
  });

  it("addGear dedupes — second add is a no-op that returns false", () => {
    const p = createProfile();
    addGear(p, "analyzer");
    const result = addGear(p, "analyzer");
    assert.equal(result, false, "addGear should return false when gear already owned");
    assert.equal(p.gear.filter((id) => id === "analyzer").length, 1, "no duplicate entries");
  });

  it("addGear rejects unknown ids — returns false, gear unchanged", () => {
    const p = createProfile();
    const result = addGear(p, "phantom-9000");
    assert.equal(result, false, "addGear should return false for unknown gear id");
    assert.deepEqual(p.gear, [], "gear array must remain empty");
  });

  it("hasGear returns true after addGear", () => {
    const p = createProfile();
    addGear(p, "dampener");
    assert.equal(hasGear(p, "dampener"), true);
  });

  it("hasGear returns false for gear not owned", () => {
    const p = createProfile();
    assert.equal(hasGear(p, "recon-rig"), false);
  });

  it("can own multiple distinct gear items", () => {
    const p = createProfile();
    addGear(p, "analyzer");
    addGear(p, "dampener");
    assert.ok(hasGear(p, "analyzer"));
    assert.ok(hasGear(p, "dampener"));
    assert.equal(p.gear.length, 2);
  });
});

describe("v2 → v3 migration (normalizeProfile via loadProfile)", () => {
  beforeEach(() => {
    _store.clear();
  });

  it("a v2 profile normalizes to v3 — gear:[] added, bank and hoard preserved", () => {
    const round = { id: "bb", rarity: "uncommon", types: ["card", "probe"], disclosed: false };
    const v2 = {
      version: 2,
      bank: 9999,
      hoard: [round],
      _hubVisits: 1,
    };
    _store.set(PROFILE_KEY, JSON.stringify(v2));

    const p = loadProfile();

    assert.equal(p.version, 3, "version must be bumped to 3");
    assert.ok(Array.isArray(p.gear), "gear must be an array after migration");
    assert.deepEqual(p.gear, [], "gear must be empty (no gear in a v2 profile)");
    assert.equal(p.bank, 9999, "bank must be preserved (not reset)");
    assert.equal(p.hoard.length, 1, "hoard must be preserved (not reset)");
    assert.equal(p.hoard[0].id, "bb", "hoard contents are intact");
  });

  it("a v2 profile with a missing hoard gets gear:[] AND hoard:[] without reset", () => {
    const v2 = { version: 2, bank: 42, _hubVisits: 0 }; // no hoard key
    _store.set(PROFILE_KEY, JSON.stringify(v2));

    const p = loadProfile();
    assert.equal(p.version, 3);
    assert.deepEqual(p.gear, []);
    assert.deepEqual(p.hoard, []);
    assert.equal(p.bank, 42, "bank preserved in partial v2");
  });

  it("a v3 profile loads without resetting gear", () => {
    const v3 = { version: 3, bank: 200, hoard: [], gear: ["analyzer"], _hubVisits: 0 };
    _store.set(PROFILE_KEY, JSON.stringify(v3));

    const p = loadProfile();
    assert.equal(p.version, 3);
    assert.deepEqual(p.gear, ["analyzer"], "existing gear must survive a normalize pass");
    assert.equal(p.bank, 200);
  });
});
