import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// soundfont2 is a CommonJS module (default export only) — import via the default and destructure.
import sf2pkg from "soundfont2";
const { SoundFont2 } = sf2pkg;
import { writeSf2 } from "../js/audio/soundfont/sf2-writer.js";

const SRC = "audio-content/soundfonts/GeneralUser-GS.sf2";

test("identity write round-trips: reparse yields same preset & sample counts + names", () => {
  const src = new SoundFont2(new Uint8Array(readFileSync(SRC)));
  const bytes = writeSf2(src); // no pruning: re-emit everything
  const out = new SoundFont2(new Uint8Array(bytes));
  assert.equal(out.presets.length, src.presets.length, "preset count preserved");
  assert.equal(out.samples.length, src.samples.length, "sample count preserved");
  assert.deepEqual(
    out.presets.map((p) => p.header.name),
    src.presets.map((p) => p.header.name),
    "preset names preserved in order",
  );
});
