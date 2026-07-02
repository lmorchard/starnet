import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitize } from "../js/audio/strudel/soundfont.js";

test("preset names become distinct gus_* sound names (not gm_*)", () => {
  assert.equal(sanitize("Warm Pad", 0, "gus_"), "gus_warm_pad");
  assert.equal(sanitize("Tine Electric Piano", 1, "gus_"), "gus_tine_electric_piano");
  assert.equal(sanitize("Synth Bass 2", 2, "gus_"), "gus_synth_bass_2");
});

test("non-alphanumerics collapse to single underscores, trimmed", () => {
  assert.equal(sanitize("Honky-Tonk Piano!!", 0, "gus_"), "gus_honky_tonk_piano");
  assert.equal(sanitize("  FM  E.Piano  ", 0, "gus_"), "gus_fm_e_piano");
});

test("blank/garbage names fall back to a stable per-index name", () => {
  assert.equal(sanitize("", 7, "gus_"), "gus_preset_7");
  assert.equal(sanitize("///", 3, "gus_"), "gus_preset_3");
});

test("names never collide with strudel.cc's gm_ namespace", () => {
  for (const n of ["Electric Piano 2", "Pad 1 (new age)", "gm something"]) {
    assert.ok(sanitize(n, 0, "gus_").startsWith("gus_"), `${n} → gus_`);
    assert.ok(!sanitize(n, 0, "gus_").startsWith("gm_"));
  }
});
