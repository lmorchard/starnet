import { test } from "node:test";
import assert from "node:assert/strict";
import { cardGalleryGroups, MOCK_SELECTED_NODE } from "../js/ui/preview-cards.js";

const groups = cardGalleryGroups();
const all = groups.flatMap((g) => g.cards);

test("cards are well-formed ExploitCards", () => {
  for (const c of all) {
    assert.ok(c.id && c.name);
    assert.ok(["common", "uncommon", "rare"].includes(c.rarity));
    assert.ok(c.quality >= 0 && c.quality <= 1);
    assert.ok(Array.isArray(c.targetVulnTypes) && c.targetVulnTypes.length >= 1);
    assert.ok(["fresh", "worn", "disclosed"].includes(c.decayState));
    assert.equal(typeof c.usesRemaining, "number");
  }
});

test("matrix covers all rarities and wear states", () => {
  assert.deepEqual([...new Set(all.map((c) => c.rarity))].sort(), ["common", "rare", "uncommon"]);
  assert.deepEqual([...new Set(all.map((c) => c.decayState))].sort(), ["disclosed", "fresh", "worn"]);
});

test("cardGalleryGroups is deterministic across repeated calls (ids stable)", () => {
  const idsOf = (gs) => gs.flatMap((g) => g.cards.map((c) => c.id));
  assert.deepEqual(idsOf(cardGalleryGroups()), idsOf(cardGalleryGroups()));
});

test("match group has a match and a no-match vs the mock node", () => {
  const known = MOCK_SELECTED_NODE.vulnerabilities
    .filter((v) => !v.patched && !v.hidden)
    .map((v) => v.id);
  const matchGroup = groups.find((g) => g.selectedNode);
  const matches = matchGroup.cards.filter((c) => c.targetVulnTypes.some((t) => known.includes(t)));
  const noMatches = matchGroup.cards.filter((c) => !c.targetVulnTypes.some((t) => known.includes(t)));
  assert.ok(matches.length >= 1, "at least one matching card");
  assert.ok(noMatches.length >= 1, "at least one non-matching card");
});
