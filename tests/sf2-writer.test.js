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

test("identity write round-trips: sample loop points and instrument generator values", () => {
  const src = new SoundFont2(new Uint8Array(readFileSync(SRC)));
  const bytes = writeSf2(src);
  const out = new SoundFont2(new Uint8Array(bytes));

  // Sample loop points: src.samples[0] ("Accordion-A#2") has startLoop=13691, endLoop=13839
  // packShdr adds start back (relative→absolute) and reparse subtracts start again → must round-trip
  const srcHdr = src.samples[0].header;
  const outHdr = out.samples[0].header;
  assert.ok(srcHdr.startLoop !== srcHdr.endLoop, "fixture: sample 0 has non-trivial loop");
  assert.equal(outHdr.startLoop, srcHdr.startLoop, "sample 0 startLoop round-trips");
  assert.equal(outHdr.endLoop, srcHdr.endLoop, "sample 0 endLoop round-trips");

  // Instrument generator scalar: presetData.instrumentGenerators[0] id=8 value=5535
  // packGen sign-extends via setInt16; reparse must recover the same id and value
  const srcGen = src.presetData.instrumentGenerators[0];
  const outGen = out.presetData.instrumentGenerators[0];
  assert.ok(!srcGen.range && srcGen.value !== 0, "fixture: igen[0] is a non-zero scalar generator");
  assert.equal(outGen.id, srcGen.id, "igen[0] id round-trips");
  assert.equal(outGen.value, srcGen.value, "igen[0] value round-trips");
});
