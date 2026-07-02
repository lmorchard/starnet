import { test } from "node:test";
import assert from "node:assert/strict";
import { SOUNDFONTS } from "../audio-content/soundfonts/manifest.js";

test("manifest entries are well-formed and prefixes are unique", () => {
  assert.ok(Array.isArray(SOUNDFONTS) && SOUNDFONTS.length >= 1);
  const prefixes = new Set();
  for (const f of SOUNDFONTS) {
    assert.match(f.prefix, /^[a-z]+_$/, "prefix is lowercase + trailing underscore");
    assert.ok(f.authoringPath && f.deployPath && f.license, "paths present");
    assert.ok(!prefixes.has(f.prefix), "prefix is unique");
    prefixes.add(f.prefix);
    assert.ok(Array.isArray(f.allow), "allow is an array");
  }
});
