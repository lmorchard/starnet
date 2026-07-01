import { test } from "node:test";
import assert from "node:assert/strict";
import { SONG_MANIFEST, resolveSongQuery, songAlias } from "../js/audio/strudel/songs/index.js";

test("songAlias is the lowercased last word of the display name", () => {
  assert.equal(songAlias({ name: "Corporate — Neon" }), "neon");
  assert.equal(songAlias({ name: "Hub Ambient" }), "ambient");
});

test("resolveSongQuery matches by exact id", () => {
  assert.equal(resolveSongQuery("corporate-neon")?.id, "corporate-neon");
  assert.equal(resolveSongQuery("hub")?.id, "hub");
});

test("resolveSongQuery matches by exact display name (case-insensitive)", () => {
  assert.equal(resolveSongQuery("Corporate — Neon")?.id, "corporate-neon");
  assert.equal(resolveSongQuery("corporate — neon")?.id, "corporate-neon");
});

test("resolveSongQuery matches by last-word alias", () => {
  assert.equal(resolveSongQuery("neon")?.id, "corporate-neon");
  assert.equal(resolveSongQuery("NEON")?.id, "corporate-neon");
  assert.equal(resolveSongQuery("ambient")?.id, "hub");
});

test("resolveSongQuery falls back to a loose name-contains match", () => {
  // "corporate" isn't an id/name/alias, but every corporate song's name contains it → first wins.
  const r = resolveSongQuery("corporate");
  assert.ok(r && r.id.startsWith("corporate-"));
});

test("resolveSongQuery returns null for empty or unknown queries", () => {
  assert.equal(resolveSongQuery(""), null);
  assert.equal(resolveSongQuery("   "), null);
  assert.equal(resolveSongQuery("no-such-song"), null);
  assert.equal(resolveSongQuery(undefined), null);
});

test("every manifest entry resolves by its own id, name, and alias", () => {
  for (const e of SONG_MANIFEST) {
    assert.equal(resolveSongQuery(e.id)?.id, e.id, `id ${e.id}`);
    assert.equal(resolveSongQuery(e.name)?.id, e.id, `name ${e.name}`);
    // alias may collide across entries (e.g. duplicate last words); assert it resolves to *some* entry
    assert.ok(resolveSongQuery(songAlias(e)), `alias ${songAlias(e)}`);
  }
});
