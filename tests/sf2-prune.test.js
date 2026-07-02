import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// soundfont2 is a CommonJS module (default export only) — import via the default and destructure.
import sf2pkg from "soundfont2";
const { SoundFont2 } = sf2pkg;
import { prunePresets } from "../js/audio/soundfont/sf2-prune.js";
import { writeSf2 } from "../js/audio/soundfont/sf2-writer.js";

const SRC = "audio-content/soundfonts/GeneralUser-GS.sf2";

test("prune to a subset: only kept presets survive, orphan samples dropped, file shrinks", () => {
  const src = new SoundFont2(new Uint8Array(readFileSync(SRC)));
  const keepNames = src.presets.slice(0, 3).map((p) => p.header.name);
  const pruned = prunePresets(src, new Set(keepNames));
  const out = new SoundFont2(new Uint8Array(writeSf2(pruned)));
  assert.deepEqual(out.presets.map((p) => p.header.name).sort(), [...keepNames].sort());
  assert.ok(out.samples.length <= src.samples.length, "sample count not larger");
  assert.ok(out.samples.length > 0, "kept presets still reference samples");
});

test("prune round-trips sample loop points (relative offsets invariant under move)", () => {
  const src = new SoundFont2(new Uint8Array(readFileSync(SRC)));
  const keepNames = src.presets.slice(0, 3).map((p) => p.header.name);
  const pruned = prunePresets(src, new Set(keepNames));
  const out = new SoundFont2(new Uint8Array(writeSf2(pruned)));

  // Find a kept sample with a non-trivial loop, matched by name across src → out.
  const srcByName = new Map(src.samples.map((s) => [s.header.name, s.header]));
  const looped = out.samples.find((s) => {
    const h = srcByName.get(s.header.name);
    return h && h.startLoop !== h.endLoop;
  });
  assert.ok(looped, "at least one kept sample has a non-trivial loop");
  const srcHdr = srcByName.get(looped.header.name);
  assert.equal(looped.header.startLoop, srcHdr.startLoop, "startLoop round-trips (relative)");
  assert.equal(looped.header.endLoop, srcHdr.endLoop, "endLoop round-trips (relative)");
});

test("prune produces a dramatically smaller file", () => {
  const src = new SoundFont2(new Uint8Array(readFileSync(SRC)));
  const keepNames = src.presets.slice(0, 3).map((p) => p.header.name);
  const pruned = prunePresets(src, new Set(keepNames));
  const bytes = writeSf2(pruned);
  assert.ok(bytes.byteLength < 5_000_000, `pruned file should be well under 5MB, got ${bytes.byteLength}`);
});
