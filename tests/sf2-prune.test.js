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

// --- Synthetic font builder for stereo-link tests -------------------------------------------
//
// Minimal in-memory structure with the shape prunePresets consumes. It reads:
//   presetHeaders[].name / .bagIndex  → select + zone range
//   presetZones[].generatorIndex      → generator range per preset zone
//   presetGenerators[].id/.value      → id 41 = instrument reference
//   instrumentHeaders[].bagIndex, instrumentZones[].generatorIndex
//   instrumentGenerators[].id/.value  → id 53 = sample reference
//   sampleHeaders[] with start/end/link/type
//   sampleData (Uint8Array of 16-bit LE PCM), metaData
//
// `sampleDefs` is an array of { name, frames (Int16 array), link, type }. Instrument 0 references
// every sample in `instRefs` (list of sample indices). One preset ("KEEP") references instrument 0.
function buildSyntheticFont(sampleDefs, instRefs) {
  // Assemble PCM + start/end offsets (no guard frames needed for source; prune adds its own).
  const int16Parts = [];
  const sampleHeaders = [];
  let cursor = 0;
  for (const s of sampleDefs) {
    const frames = Int16Array.from(s.frames);
    int16Parts.push(frames);
    sampleHeaders.push({
      name: s.name,
      start: cursor,
      end: cursor + frames.length,
      startLoop: 0,
      endLoop: 0,
      sampleRate: 44100,
      originalPitch: 60,
      pitchCorrection: 0,
      link: s.link,
      type: s.type,
    });
    cursor += frames.length;
  }
  // Terminal EOS sentinel sample header.
  sampleHeaders.push({
    name: "EOS", start: cursor, end: cursor, startLoop: 0, endLoop: 0,
    sampleRate: 0, originalPitch: 0, pitchCorrection: 0, link: 0, type: 0,
  });

  // Flatten Int16 PCM to a byte Uint8Array (LE).
  let totalFrames = 0;
  for (const p of int16Parts) totalFrames += p.length;
  const allInt16 = new Int16Array(totalFrames);
  {
    let pos = 0;
    for (const p of int16Parts) { allInt16.set(p, pos); pos += p.length; }
  }
  const sampleData = new Uint8Array(allInt16.buffer.slice(0));

  // Instrument 0: one zone referencing each sample index in instRefs (gen id 53).
  const instrumentGenerators = instRefs.map((sampleIdx) => ({ id: 53, value: sampleIdx }));
  const instrumentZones = instRefs.map((_, zi) => ({ generatorIndex: zi, modulatorIndex: 0 }));
  // Terminal bag row.
  instrumentZones.push({ generatorIndex: instrumentGenerators.length, modulatorIndex: 0 });
  const instrumentHeaders = [
    { name: "inst0", bagIndex: 0 },
    { name: "EOI", bagIndex: instRefs.length }, // sentinel: bounds inst0's zones
  ];

  // Preset "KEEP": one zone with a single instrument generator (id 41 → instrument 0).
  const presetGenerators = [{ id: 41, value: 0 }];
  const presetZones = [
    { generatorIndex: 0, modulatorIndex: 0 },
    { generatorIndex: presetGenerators.length, modulatorIndex: 0 }, // terminal bag
  ];
  const presetHeaders = [
    { name: "KEEP", preset: 0, bank: 0, bagIndex: 0 },
    { name: "EOP", preset: 0, bank: 0, bagIndex: 1 }, // sentinel: bounds KEEP's zones
  ];

  return {
    presetData: {
      presetHeaders,
      presetZones,
      presetGenerators,
      presetModulators: [],
      instrumentHeaders,
      instrumentZones,
      instrumentGenerators,
      instrumentModulators: [],
      sampleHeaders,
    },
    sampleData,
    metaData: { name: "synthetic", version: "2.1" },
  };
}

test("prune remaps stereo sampleHeader.link to the partner's NEW index", () => {
  // Three samples: [0]=left (partner→2), [1]=unrelated mono, [2]=right (partner→0).
  // The instrument references only the stereo pair (0 and 2), NOT the unrelated mono [1].
  // After pruning, sample [1] is culled; the pair compacts to indices {0,1}. Their links must
  // point at each OTHER's new index, not the stale old index (which the buggy code copies verbatim).
  const font = buildSyntheticFont(
    [
      { name: "left", frames: [10, 20, 30], link: 2, type: 4 },      // Left → partner idx 2
      { name: "mono_orphan", frames: [99], link: 0, type: 1 },        // unrelated, culled
      { name: "right", frames: [40, 50, 60], link: 0, type: 2 },      // Right → partner idx 0
    ],
    [0, 2], // instrument references samples 0 and 2
  );

  const pruned = prunePresets(font, new Set(["KEEP"]));
  const headers = pruned.presetData.sampleHeaders;
  // Drop the terminal EOS sentinel (type 0) for pairing checks.
  const kept = headers.filter((h) => h.type !== 0 && h.name !== "EOS");
  assert.equal(kept.length, 2, "only the two referenced samples survive");

  const byName = new Map(kept.map((h) => [h.name, h]));
  const left = byName.get("left");
  const right = byName.get("right");
  assert.ok(left && right, "both stereo partners kept");

  const leftIdx = headers.indexOf(left);
  const rightIdx = headers.indexOf(right);

  assert.equal(left.type, 4, "left stays Left(4)");
  assert.equal(right.type, 2, "right stays Right(2)");
  // The load-bearing assertion: links resolve to each other's NEW indices, not the stale old ones.
  assert.equal(left.link, rightIdx, "left.link points at right's NEW index");
  assert.equal(right.link, leftIdx, "right.link points at left's NEW index");
});

test("prune zeros the link and marks mono when a stereo partner is culled", () => {
  // Stereo left sample [0] whose partner [1] is NOT referenced by the instrument (gets culled).
  // The surviving orphan's link must be zeroed and type downgraded to mono, so the reparser
  // doesn't resolve a bogus partner.
  const font = buildSyntheticFont(
    [
      { name: "left_lonely", frames: [10, 20, 30], link: 1, type: 4 }, // Left → partner idx 1 (culled)
      { name: "right_culled", frames: [40, 50, 60], link: 0, type: 2 },
    ],
    [0], // instrument references only sample 0
  );

  const pruned = prunePresets(font, new Set(["KEEP"]));
  const headers = pruned.presetData.sampleHeaders;
  const kept = headers.filter((h) => h.type !== 0 && h.name !== "EOS");
  assert.equal(kept.length, 1, "only the referenced sample survives");
  const orphan = kept[0];
  assert.equal(orphan.name, "left_lonely");
  assert.equal(orphan.link, 0, "dangling link zeroed");
  assert.equal(orphan.type, 1, "coerced to Mono(1)");
});

test("prune preserves bit-exact PCM for a kept sample (no audio corruption)", () => {
  const src = new SoundFont2(new Uint8Array(readFileSync(SRC)));
  const keepNames = src.presets.slice(0, 3).map((p) => p.header.name);
  const pruned = prunePresets(src, new Set(keepNames));
  const out = new SoundFont2(new Uint8Array(writeSf2(pruned)));

  const srcByName = new Map(src.samples.map((s) => [s.header.name, s]));
  let checked = 0;
  for (const outSample of out.samples) {
    const srcSample = srcByName.get(outSample.header.name);
    if (!srcSample) continue;
    assert.deepEqual(
      outSample.data, srcSample.data,
      `PCM for '${outSample.header.name}' must be bit-exact`,
    );
    checked++;
  }
  assert.ok(checked > 0, "at least one kept sample matched by name");
});

test("prune dedups a shared instrument referenced by two kept presets", () => {
  const src = new SoundFont2(new Uint8Array(readFileSync(SRC)));

  // Find two presets that reference the same instrument index (id 41 in a preset zone generator).
  const pd = src.presetData;
  const presetInstrumentSets = [];
  for (let i = 0; i < pd.presetHeaders.length - 1; i++) {
    const zStart = pd.presetHeaders[i].bagIndex;
    const zEnd = pd.presetHeaders[i + 1].bagIndex;
    const insts = new Set();
    for (let zi = zStart; zi < zEnd; zi++) {
      const gStart = pd.presetZones[zi].generatorIndex;
      const gEnd = pd.presetZones[zi + 1].generatorIndex;
      for (let gi = gStart; gi < gEnd; gi++) {
        const g = pd.presetGenerators[gi];
        if (g.id === 41 && typeof g.value === "number") insts.add(g.value);
      }
    }
    presetInstrumentSets.push({ name: pd.presetHeaders[i].name, insts });
  }

  // Locate a shared instrument index across two distinct presets.
  let pairNames = null;
  outer: for (let a = 0; a < presetInstrumentSets.length; a++) {
    for (let b = a + 1; b < presetInstrumentSets.length; b++) {
      for (const inst of presetInstrumentSets[a].insts) {
        if (presetInstrumentSets[b].insts.has(inst)) {
          pairNames = [presetInstrumentSets[a].name, presetInstrumentSets[b].name];
          break outer;
        }
      }
    }
  }
  assert.ok(pairNames, "found two presets sharing an instrument");

  const pruned = prunePresets(src, new Set(pairNames));
  // Count non-sentinel instrument headers in the pruned output.
  const instHeaders = pruned.presetData.instrumentHeaders;
  const nonSentinel = instHeaders.slice(0, -1); // drop terminal EOI
  const nameCounts = new Map();
  for (const h of nonSentinel) nameCounts.set(h.name, (nameCounts.get(h.name) ?? 0) + 1);
  for (const [name, count] of nameCounts) {
    assert.equal(count, 1, `instrument '${name}' appears exactly once (deduped)`);
  }

  // And both presets' zones resolve to a valid instrument index in the pruned table.
  const out = new SoundFont2(new Uint8Array(writeSf2(pruned)));
  const outNames = out.presets.map((p) => p.header.name).sort();
  assert.deepEqual(outNames, [...pairNames].sort(), "both kept presets survive");
});
