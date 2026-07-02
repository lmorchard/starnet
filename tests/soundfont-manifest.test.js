import { test } from "node:test";
import assert from "node:assert/strict";
import { SOUNDFONTS } from "../audio-content/soundfonts/manifest.js";

test("manifest has exactly 9 entries", () => {
  assert.strictEqual(SOUNDFONTS.length, 9, "expected 9 entries: gus_ + 8 topical msg sets");
});

test("manifest entries are well-formed and prefixes are unique", () => {
  assert.ok(Array.isArray(SOUNDFONTS) && SOUNDFONTS.length >= 1);
  const prefixes = new Set();
  for (const f of SOUNDFONTS) {
    assert.match(f.prefix, /^[a-z]+_$/, "prefix is lowercase + trailing underscore");
    assert.ok(!prefixes.has(f.prefix), `prefix is unique: ${f.prefix}`);
    prefixes.add(f.prefix);
    assert.ok(f.authoringPath, "authoringPath is present");
    assert.ok(f.license, "license is present");
    assert.ok(Array.isArray(f.allow), "allow is an array");
    // deployPath, if present, must be a string
    if (f.deployPath !== undefined) {
      assert.strictEqual(typeof f.deployPath, "string", "deployPath must be a string when present");
    }
    // authoringOnly, if present, must be boolean
    if (f.authoringOnly !== undefined) {
      assert.strictEqual(typeof f.authoringOnly, "boolean", "authoringOnly must be boolean when present");
    }
  }
});
