import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { on, off, E } from "../js/core/events.js";

// audio-prefs seeds its enabled flags from localStorage at MODULE LOAD, so install a stub
// (seeded with non-default values) before importing the module — that also proves the seeding
// path. Restore the original localStorage afterward so other test files aren't left with a stub.
const _origLocalStorage = globalThis.localStorage;
const store = new Map();
let prefs;

before(async () => {
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  // Seed non-default (false) so the module-load seeding is observable.
  store.set("starnet:music-enabled", "false");
  store.set("starnet:sfx-enabled", "false");
  prefs = await import("../js/audio/audio-prefs.js");
});

after(() => { globalThis.localStorage = _origLocalStorage; });

test("seeds enabled flags from localStorage at module load", () => {
  assert.equal(prefs.isMusicEnabled(), false);
  assert.equal(prefs.isSfxEnabled(), false);
});

test("setMusicEnabled persists, updates state, emits MUSIC_CHANGED", () => {
  let seen = null;
  const h = (p) => { seen = p; }; on(E.MUSIC_CHANGED, h);
  const rv = prefs.setMusicEnabled(true);
  off(E.MUSIC_CHANGED, h); off(E.SFX_CHANGED, h);
  assert.equal(rv, true);
  assert.equal(prefs.isMusicEnabled(), true);
  assert.equal(store.get("starnet:music-enabled"), "true");
  assert.deepEqual(seen, { enabled: true });
});

test("toggleMusic flips and emits", () => {
  prefs.setMusicEnabled(true);        // explicit starting state (self-contained, order-independent)
  let seen = null;
  const h = (p) => { seen = p; }; on(E.MUSIC_CHANGED, h);
  const rv = prefs.toggleMusic();     // true → false
  off(E.MUSIC_CHANGED, h); off(E.SFX_CHANGED, h);
  assert.equal(rv, false);
  assert.equal(prefs.isMusicEnabled(), false);
  assert.deepEqual(seen, { enabled: false });
});

test("setSfxEnabled persists, updates state, emits SFX_CHANGED", () => {
  let seen = null;
  const h = (p) => { seen = p; }; on(E.SFX_CHANGED, h);
  const rv = prefs.setSfxEnabled(true);
  off(E.MUSIC_CHANGED, h); off(E.SFX_CHANGED, h);
  assert.equal(rv, true);
  assert.equal(prefs.isSfxEnabled(), true);
  assert.equal(store.get("starnet:sfx-enabled"), "true");
  assert.deepEqual(seen, { enabled: true });
});

test("toggleSfx flips and emits", () => {
  prefs.setSfxEnabled(true);          // explicit starting state (self-contained, order-independent)
  let seen = null;
  const h = (p) => { seen = p; }; on(E.SFX_CHANGED, h);
  const rv = prefs.toggleSfx();       // true → false
  off(E.MUSIC_CHANGED, h); off(E.SFX_CHANGED, h);
  assert.equal(rv, false);
  assert.equal(prefs.isSfxEnabled(), false);
  assert.deepEqual(seen, { enabled: false });
});
