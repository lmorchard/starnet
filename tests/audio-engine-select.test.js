import { test } from "node:test";
import assert from "node:assert/strict";
import { getAudioEngine, setAudioEngine, AUDIO_ENGINES } from "../js/audio/engine-select.js";

// Minimal Map-backed localStorage stub (node has no localStorage).
function installStorage() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

test("AUDIO_ENGINES lists tone and strudel", () => {
  assert.deepEqual([...AUDIO_ENGINES].sort(), ["strudel", "tone"]);
});

test("defaults to tone when unset", () => {
  installStorage();
  assert.equal(getAudioEngine(), "tone");
});

test("setAudioEngine persists the choice and returns it", () => {
  installStorage();
  assert.equal(setAudioEngine("strudel"), "strudel");
  assert.equal(getAudioEngine(), "strudel");
});

test("setAudioEngine rejects an unknown engine and leaves the pref unchanged", () => {
  installStorage();
  setAudioEngine("strudel");
  assert.equal(setAudioEngine("bogus"), null);
  assert.equal(getAudioEngine(), "strudel");
});

test("getAudioEngine falls back to tone when storage throws", () => {
  globalThis.localStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };
  assert.equal(getAudioEngine(), "tone");
  assert.equal(setAudioEngine("strudel"), "strudel"); // returns the value even if persist fails
});
