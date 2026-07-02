import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitize, resolveFontUrl } from "../js/audio/strudel/soundfont.js";

test("sanitize applies the given prefix", () => {
  assert.equal(sanitize("Warm Pad", 0, "gus_"), "gus_warm_pad");
  assert.equal(sanitize("Warm Pad", 0, "msgpad_"), "msgpad_warm_pad");
});

test("resolveFontUrl prefers deploy, falls back to authoring on failed probe", async () => {
  const entry = { deployPath: "D", authoringPath: "A" };
  assert.equal(await resolveFontUrl(entry, async (u) => u === "D"), "D");   // deploy exists
  assert.equal(await resolveFontUrl(entry, async (u) => u === "A"), "A");   // deploy 404 → authoring
});

test("resolveFontUrl returns authoringPath without probing when deployPath is absent", async () => {
  let probeCallCount = 0;
  const probe = async (_path) => { probeCallCount++; return true; };
  const entry = { authoringPath: "A" }; // no deployPath — topical/shipped-whole set
  const result = await resolveFontUrl(entry, probe);
  assert.equal(result, "A", "should resolve to authoringPath");
  assert.equal(probeCallCount, 0, "probe must not be called when deployPath is absent");
});
