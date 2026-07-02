// @ts-check
// Pure-JS SoundFont2 preset PRUNER.
//
// Given a parsed `soundfont2` font and a set of preset names to keep, produce a subsetted
// chunk-table structure of the SAME shape `writeSf2()` consumes (`{ presetData, sampleData,
// metaData }`). `writeSf2(prunePresets(font, keep))` yields a minimal SF2 containing only the
// kept presets, the instruments they reference, the samples those instruments reference, and the
// PCM for those samples (compacted, with inter-sample guard zeros).
//
// Works at the flat chunk-table level (`font.presetData.*`), NOT the resolved object graph.
//
// SF2 bag layout recap: a header row carries a "bag index" (`bagIndex`) into the zone (bag) array;
// header i's zones span [headers[i].bagIndex, headers[i+1].bagIndex). Each zone (bag) row carries
// `generatorIndex`/`modulatorIndex` into the flat gen/mod arrays; zone j's generators span
// [zones[j].generatorIndex, zones[j+1].generatorIndex) (and likewise for modulators). Terminal
// SENTINEL rows (phdr "EOP", inst "EOI", shdr "EOS", plus terminal bag rows) exist so the
// "next" lookup always has an upper bound. We preserve that invariant in the pruned output.
//
// Generator ids that carry cross-references:
//   41 = instrument (preset zone → instrument index)
//   53 = sampleID   (instrument zone → sample index)

/** Guard frames appended after each sample's PCM per SF2 spec (min 46 zero sample points). */
const GUARD_FRAMES = 46;

/** Generator id for a preset zone's instrument reference. */
const GEN_INSTRUMENT = 41;
/** Generator id for an instrument zone's sample reference. */
const GEN_SAMPLE_ID = 53;

/**
 * Slice the [start, end) range of zone/bag rows belonging to header `i`, using the next header's
 * bag index as the exclusive upper bound.
 * @param {any[]} headers
 * @param {number} i
 * @returns {[number, number]} [firstZone, lastZoneExclusive]
 */
function zoneRangeFor(headers, i) {
  const start = headers[i].bagIndex;
  const end = headers[i + 1].bagIndex; // next header always exists (sentinel guarantees it)
  return [start, end];
}

/**
 * Slice the [start, end) range of generator (or modulator) rows belonging to zone `j`.
 * @param {any[]} zones
 * @param {number} j
 * @param {"generatorIndex" | "modulatorIndex"} key
 * @returns {[number, number]}
 */
function itemRangeFor(zones, j, key) {
  const start = zones[j][key];
  const end = zones[j + 1][key]; // terminal bag row guarantees a next row
  return [start, end];
}

/**
 * Rebuild a header table's zones/generators/modulators for a set of kept header indices,
 * compacting the arrays and remapping bag/gen/mod indices. Handles both preset and instrument
 * tables (identical bag structure). Also invokes an optional per-generator rewrite so callers can
 * remap cross-reference generator values (instrument index / sample index) to their NEW indices.
 *
 * @param {Object} params
 * @param {any[]} params.headers          Full header array INCLUDING the terminal sentinel row.
 * @param {any[]} params.zones            Full bag array INCLUDING the terminal bag row.
 * @param {any[]} params.generators       Full generator array.
 * @param {any[]} params.modulators       Full modulator array.
 * @param {number[]} params.keepIndices   Header indices to keep, in output order (excludes sentinel).
 * @param {(gen: any) => any} [params.rewriteGen]  Maps a generator to a (possibly new) generator.
 * @returns {{ headers: any[], zones: any[], generators: any[], modulators: any[] }}
 */
function rebuildTable({ headers, zones, generators, modulators, keepIndices, rewriteGen }) {
  const outHeaders = [];
  const outZones = [];
  const outGenerators = [];
  const outModulators = [];

  for (const hi of keepIndices) {
    const [zStart, zEnd] = zoneRangeFor(headers, hi);
    // This header's first zone begins at the current length of the compacted zone array.
    const newBagIndex = outZones.length;
    outHeaders.push({ ...headers[hi], bagIndex: newBagIndex });

    for (let zi = zStart; zi < zEnd; zi++) {
      const [gStart, gEnd] = itemRangeFor(zones, zi, "generatorIndex");
      const [mStart, mEnd] = itemRangeFor(zones, zi, "modulatorIndex");
      outZones.push({
        generatorIndex: outGenerators.length,
        modulatorIndex: outModulators.length,
      });
      for (let gi = gStart; gi < gEnd; gi++) {
        const g = generators[gi];
        outGenerators.push(rewriteGen ? rewriteGen(g) : g);
      }
      for (let mi = mStart; mi < mEnd; mi++) {
        outModulators.push(modulators[mi]);
      }
    }
  }

  // Terminal sentinel header: copy the original last row but point its bag index at the end of
  // the compacted zone array (so the last kept header's zone range is bounded correctly).
  const sentinelHeader = { ...headers[headers.length - 1], bagIndex: outZones.length };
  outHeaders.push(sentinelHeader);
  // Terminal bag row: gen/mod indices point past the compacted gen/mod arrays.
  outZones.push({ generatorIndex: outGenerators.length, modulatorIndex: outModulators.length });

  return { headers: outHeaders, zones: outZones, generators: outGenerators, modulators: outModulators };
}

/**
 * Collect the set of cross-reference target indices (instrument or sample) named by a given
 * generator id across all zones of the kept headers.
 * @param {any[]} headers
 * @param {any[]} zones
 * @param {any[]} generators
 * @param {number[]} keepIndices
 * @param {number} genId
 * @returns {Set<number>}
 */
function collectReferences(headers, zones, generators, keepIndices, genId) {
  const refs = new Set();
  for (const hi of keepIndices) {
    const [zStart, zEnd] = zoneRangeFor(headers, hi);
    for (let zi = zStart; zi < zEnd; zi++) {
      const [gStart, gEnd] = itemRangeFor(zones, zi, "generatorIndex");
      for (let gi = gStart; gi < gEnd; gi++) {
        const g = generators[gi];
        if (g.id === genId && typeof g.value === "number") refs.add(g.value);
      }
    }
  }
  return refs;
}

/**
 * Prune a parsed soundfont down to a set of preset names.
 * @param {any} font - a soundfont2 SoundFont2 instance (reads `font.presetData`, `font.sampleData`,
 *   `font.metaData`).
 * @param {Set<string>} keepNameSet - preset names (`presetHeaders[].name`) to retain.
 * @returns {{ presetData: any, sampleData: Uint8Array, metaData: any }} a structure writeSf2 accepts.
 */
export function prunePresets(font, keepNameSet) {
  const pd = font.presetData;
  if (!pd) throw new Error("prunePresets: font.presetData is required");

  const {
    presetHeaders,
    presetZones,
    presetGenerators,
    presetModulators,
    instrumentHeaders,
    instrumentZones,
    instrumentGenerators,
    instrumentModulators,
    sampleHeaders,
  } = pd;

  // --- 1. Select kept presets (all header rows except the EOP sentinel whose name is in the set) ---
  const keptPresetIdx = [];
  for (let i = 0; i < presetHeaders.length - 1; i++) {
    if (keepNameSet.has(presetHeaders[i].name)) keptPresetIdx.push(i);
  }
  if (keptPresetIdx.length === 0) {
    throw new Error("prunePresets: no presets matched keepNameSet");
  }

  // --- 2. Collect referenced instruments, keep them, build old→new instrument index map ---
  const keptInstrumentSet = collectReferences(
    presetHeaders, presetZones, presetGenerators, keptPresetIdx, GEN_INSTRUMENT,
  );
  const keptInstrumentIdx = [...keptInstrumentSet].sort((a, b) => a - b);
  const instrumentRemap = new Map(keptInstrumentIdx.map((oldIdx, newIdx) => [oldIdx, newIdx]));

  // --- 3. Collect referenced samples (from kept instruments), keep them, build old→new sample map ---
  const keptSampleSet = collectReferences(
    instrumentHeaders, instrumentZones, instrumentGenerators, keptInstrumentIdx, GEN_SAMPLE_ID,
  );
  const keptSampleIdx = [...keptSampleSet].sort((a, b) => a - b);
  const sampleRemap = new Map(keptSampleIdx.map((oldIdx, newIdx) => [oldIdx, newIdx]));

  if (keptSampleIdx.length === 0) {
    throw new Error("prunePresets: kept presets reference no samples");
  }

  // --- 4. Rebuild preset table: remap instrument-generator (id 41) values to NEW instrument index ---
  const prunedPresets = rebuildTable({
    headers: presetHeaders,
    zones: presetZones,
    generators: presetGenerators,
    modulators: presetModulators,
    keepIndices: keptPresetIdx,
    rewriteGen: (g) => {
      if (g.id === GEN_INSTRUMENT && instrumentRemap.has(g.value)) {
        return { ...g, value: instrumentRemap.get(g.value) };
      }
      return g;
    },
  });

  // --- 5. Rebuild instrument table: remap sampleID-generator (id 53) values to NEW sample index ---
  const prunedInstruments = rebuildTable({
    headers: instrumentHeaders,
    zones: instrumentZones,
    generators: instrumentGenerators,
    modulators: instrumentModulators,
    keepIndices: keptInstrumentIdx,
    rewriteGen: (g) => {
      if (g.id === GEN_SAMPLE_ID && sampleRemap.has(g.value)) {
        return { ...g, value: sampleRemap.get(g.value) };
      }
      return g;
    },
  });

  // --- 6. Rebuild sample headers + compact PCM ---
  // Original PCM is a byte Uint8Array of 16-bit LE frames. For each kept sample, copy frames
  // [oldStart, oldEnd) and re-base start/end to the compacted buffer. Loop points are stored
  // RELATIVE to start by soundfont2 and packShdr re-adds start, so leave them UNCHANGED.
  const rawSamples = font.sampleData instanceof Uint8Array
    ? font.sampleData
    : new Uint8Array(font.sampleData?.buffer ?? font.sampleData ?? 0);

  const outSampleHeaders = [];
  const pcmParts = [];
  let frameCursor = 0; // running frame offset into the compacted buffer

  for (const oldIdx of keptSampleIdx) {
    const h = sampleHeaders[oldIdx];
    const oldStart = h.start >>> 0;
    const oldEnd = h.end >>> 0;
    const frameCount = oldEnd - oldStart;

    const pcm = rawSamples.subarray(oldStart * 2, oldEnd * 2);
    pcmParts.push(pcm);

    // `link` is an index into sampleHeaders pointing at the stereo partner; it must be remapped
    // like any other sample index. If the partner was culled, the pairing is broken — zero the
    // link and mark the sample mono so no bogus partner is resolved on reparse.
    let newLink = 0;
    let newType = h.type;
    const isStereo = h.type === 2 || h.type === 4; // Right / Left (ignore ROM/linked exotics)
    if (isStereo && sampleRemap.has(h.link)) {
      newLink = sampleRemap.get(h.link);
    } else if (isStereo) {
      newType = 1; // partner culled → downgrade to Mono
    }

    outSampleHeaders.push({
      ...h,
      start: frameCursor,
      end: frameCursor + frameCount,
      link: newLink,
      type: newType,
      // startLoop / endLoop left unchanged (relative offsets, invariant under move)
    });

    frameCursor += frameCount;
    // Inter-sample guard: append zero frames and advance the cursor past them so the next
    // sample's start accounts for the gap.
    pcmParts.push(new Uint8Array(GUARD_FRAMES * 2));
    frameCursor += GUARD_FRAMES;
  }

  // Terminal EOS sentinel sample header (copy original last row; its offsets are all zero).
  outSampleHeaders.push({ ...sampleHeaders[sampleHeaders.length - 1] });

  // Assemble compacted PCM.
  let pcmLen = 0;
  for (const p of pcmParts) pcmLen += p.length;
  const sampleData = new Uint8Array(pcmLen);
  {
    let pos = 0;
    for (const p of pcmParts) {
      sampleData.set(p, pos);
      pos += p.length;
    }
  }

  // --- Self-consistency guard: max(end)*2 must not exceed the compacted PCM byte length. ---
  // writeSf2 trims the smpl chunk to max(end)*2, so real sample data must all lie within that.
  // (The trailing guard block after the last sample sits past max(end) and gets trimmed — fine.)
  let maxEndFrame = 0;
  for (const h of outSampleHeaders) {
    if (h.end > maxEndFrame) maxEndFrame = h.end;
  }
  if (maxEndFrame * 2 > sampleData.length) {
    throw new Error(
      `prunePresets: offset math error — max sample end (${maxEndFrame * 2} bytes) exceeds ` +
      `compacted PCM length (${sampleData.length} bytes)`,
    );
  }

  return {
    presetData: {
      presetHeaders: prunedPresets.headers,
      presetZones: prunedPresets.zones,
      presetGenerators: prunedPresets.generators,
      presetModulators: prunedPresets.modulators,
      instrumentHeaders: prunedInstruments.headers,
      instrumentZones: prunedInstruments.zones,
      instrumentGenerators: prunedInstruments.generators,
      instrumentModulators: prunedInstruments.modulators,
      sampleHeaders: outSampleHeaders,
    },
    sampleData,
    metaData: font.metaData,
  };
}
