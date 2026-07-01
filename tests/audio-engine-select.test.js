import { test, after } from "node:test";
import assert from "node:assert/strict";
import { getAudioEngine, setAudioEngine, AUDIO_ENGINES } from "../js/audio/engine-select.js";

// These tests replace globalThis.localStorage with stubs; restore the original once done so other
// test files aren't left with a stub (avoids cross-file order dependence).
const _origLocalStorage = globalThis.localStorage;
after(() => { globalThis.localStorage = _origLocalStorage; });

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

test("defaults to strudel when unset", () => {
  installStorage();
  assert.equal(getAudioEngine(), "strudel");
});

test("setAudioEngine persists the choice and returns it", () => {
  installStorage();
  assert.equal(setAudioEngine("strudel"), "strudel");
  assert.equal(getAudioEngine(), "strudel");
});

test("setAudioEngine rejects an unknown engine and leaves the pref unchanged", () => {
  installStorage();
  setAudioEngine("tone");   // set the NON-default so the assertion is distinguishable from the default
  assert.equal(setAudioEngine("bogus"), null);
  assert.equal(getAudioEngine(), "tone");
});

test("getAudioEngine falls back to strudel (the default) when storage throws", () => {
  globalThis.localStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };
  assert.equal(getAudioEngine(), "strudel");
  assert.equal(setAudioEngine("tone"), "tone"); // returns the value even if persist fails
});
