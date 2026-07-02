// @ts-check
// Pure-JS SoundFont2 (SF2.01) binary serializer.
//
// Re-packs a parsed soundfont2 object graph back into an SF2 RIFF file. Works at the raw
// chunk-table level (`font.presetData.*` flat arrays) so it round-trips a font unchanged and,
// later, so a PRUNED chunk-table structure of the same shape can be serialized the same way.
//
// This module ONLY serializes. It does not prune — that is a separate step that produces a
// structure with the same shape as the input contract below.
//
// Input contract — `writeSf2(font)` reads:
//   font.presetData.presetHeaders       — [{ name, preset, bank, bagIndex, library, genre, morphology }]
//   font.presetData.presetZones         — [{ generatorIndex, modulatorIndex }]
//   font.presetData.presetModulators    — [{ source, id, value, valueSource, transform }]
//   font.presetData.presetGenerators    — [{ id, value } | { id, range:{lo,hi} }]
//   font.presetData.instrumentHeaders   — [{ name, bagIndex }]
//   font.presetData.instrumentZones     — [{ generatorIndex, modulatorIndex }]
//   font.presetData.instrumentModulators— [{ source, id, value, valueSource, transform }]
//   font.presetData.instrumentGenerators— [{ id, value } | { id, range:{lo,hi} }]
//   font.presetData.sampleHeaders       — [{ name, start, end, startLoop, endLoop, sampleRate,
//                                            originalPitch, pitchCorrection, link, type }]
//   font.sampleData                     — Uint8Array of 16-bit LE PCM for the `smpl` block
//   font.metaData                       — INFO fields (used to build INFO when raw chunk absent)
//   font.chunk (optional)               — raw RIFF tree; when present, INFO is copied verbatim
//                                         (byte-identical) instead of rebuilt from metaData
//
// All the sentinel terminal records (phdr "EOP", inst "EOI", shdr "EOS", and the terminal bag
// rows) are ALREADY present in the flat arrays as parsed, so they are emitted as-is — do not
// append sentinels here.
//
// All multi-byte integers are little-endian. All chunks are word-aligned (odd byte counts padded
// with a trailing NUL).

/**
 * @typedef {Object} ModulatorValue
 * @property {number} type
 * @property {number} polarity
 * @property {number} direction
 * @property {number} palette
 * @property {number} index
 */

/**
 * @typedef {Object} Modulator
 * @property {ModulatorValue} source
 * @property {number} id
 * @property {number} value
 * @property {ModulatorValue} valueSource
 * @property {number} transform
 */

/** SF2.01 fixed record sizes (bytes). */
const SIZE = {
  phdr: 38,
  pbag: 4,
  pmod: 10,
  pgen: 4,
  inst: 22,
  ibag: 4,
  imod: 10,
  igen: 4,
  shdr: 46,
};

/** Generator ids that carry a byte range ({lo,hi}) instead of a scalar value: keyRange, velRange. */
const RANGE_GEN_IDS = new Set([43, 44]);

/**
 * A minimal growable byte sink. Collects chunk buffers, then concatenates once.
 */
class ByteSink {
  constructor() {
    /** @type {Uint8Array[]} */
    this.parts = [];
    this.length = 0;
  }
  /** @param {Uint8Array} bytes */
  push(bytes) {
    this.parts.push(bytes);
    this.length += bytes.length;
  }
  /** @returns {Uint8Array} */
  concat() {
    const out = new Uint8Array(this.length);
    let pos = 0;
    for (const p of this.parts) {
      out.set(p, pos);
      pos += p.length;
    }
    return out;
  }
}

/**
 * Pack an ASCII name into a fixed-length byte field, NUL-padded and truncated.
 * @param {DataView} view
 * @param {number} offset
 * @param {string} name
 * @param {number} fieldLen
 */
function writeName(view, offset, name, fieldLen) {
  const s = String(name ?? "");
  for (let i = 0; i < fieldLen; i++) {
    const code = i < s.length ? s.charCodeAt(i) & 0xff : 0;
    view.setUint8(offset + i, code);
  }
}

/**
 * Pack an SFModulator value ({type,polarity,direction,palette,index}) into its 16-bit bitfield,
 * mirroring soundfont2's getModulatorValue():
 *   type<<10 | polarity<<9 | direction<<8 | palette<<7 | index
 * @param {ModulatorValue} m
 * @returns {number}
 */
function packModulatorValue(m) {
  return (
    ((m.type & 0x3f) << 10) |
    ((m.polarity & 1) << 9) |
    ((m.direction & 1) << 8) |
    ((m.palette & 1) << 7) |
    (m.index & 0x7f)
  ) & 0xffff;
}

/**
 * Build a chunk body for a fixed-size record array.
 * @param {any[]} records
 * @param {number} recordSize
 * @param {(view: DataView, off: number, rec: any) => void} packFn
 * @returns {Uint8Array}
 */
function packRecords(records, recordSize, packFn) {
  const buf = new Uint8Array(records.length * recordSize);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < records.length; i++) {
    packFn(view, i * recordSize, records[i]);
  }
  return buf;
}

/** @param {DataView} v @param {number} o @param {any} h */
function packPhdr(v, o, h) {
  writeName(v, o, h.name, 20);
  v.setUint16(o + 20, h.preset & 0xffff, true);
  v.setUint16(o + 22, h.bank & 0xffff, true);
  v.setUint16(o + 24, h.bagIndex & 0xffff, true);
  v.setUint32(o + 26, (h.library ?? 0) >>> 0, true);
  v.setUint32(o + 30, (h.genre ?? 0) >>> 0, true);
  v.setUint32(o + 34, (h.morphology ?? 0) >>> 0, true);
}

/** @param {DataView} v @param {number} o @param {any} z */
function packBag(v, o, z) {
  v.setUint16(o, z.generatorIndex & 0xffff, true);
  v.setUint16(o + 2, z.modulatorIndex & 0xffff, true);
}

/** @param {DataView} v @param {number} o @param {Modulator} m */
function packMod(v, o, m) {
  v.setUint16(o, packModulatorValue(m.source), true);
  v.setUint16(o + 2, m.id & 0xffff, true);
  v.setInt16(o + 4, m.value | 0, true);
  v.setUint16(o + 6, packModulatorValue(m.valueSource), true);
  v.setUint16(o + 8, m.transform & 0xffff, true);
}

/** @param {DataView} v @param {number} o @param {any} g */
function packGen(v, o, g) {
  v.setUint16(o, g.id & 0xffff, true);
  if (RANGE_GEN_IDS.has(g.id) && g.range) {
    v.setUint8(o + 2, g.range.lo & 0xff);
    v.setUint8(o + 3, g.range.hi & 0xff);
  } else {
    // scalar amount — signed 16-bit (covers both signed and unsigned generator amounts)
    v.setInt16(o + 2, (g.value | 0) << 16 >> 16, true);
  }
}

/** @param {DataView} v @param {number} o @param {any} h */
function packInst(v, o, h) {
  writeName(v, o, h.name, 20);
  v.setUint16(o + 20, h.bagIndex & 0xffff, true);
}

/**
 * @param {DataView} v @param {number} o @param {any} h
 *
 * IMPORTANT: soundfont2's constructor MUTATES each sample header in place during getSamples()
 * (`header.startLoop -= header.start; header.endLoop -= header.start`), so the values exposed on
 * `presetData.sampleHeaders` are RELATIVE to `start`. The on-disk shdr stores ABSOLUTE loop
 * offsets, so we add `start` back here to restore the original bytes. Without this the reparse
 * double-subtracts `start` and the loop points go negative.
 */
function packShdr(v, o, h) {
  const start = (h.start ?? 0) >>> 0;
  writeName(v, o, h.name, 20);
  v.setUint32(o + 20, start, true);
  v.setUint32(o + 24, (h.end ?? 0) >>> 0, true);
  v.setUint32(o + 28, (((h.startLoop ?? 0) + start) >>> 0), true);
  v.setUint32(o + 32, (((h.endLoop ?? 0) + start) >>> 0), true);
  v.setUint32(o + 36, (h.sampleRate ?? 0) >>> 0, true);
  v.setUint8(o + 40, (h.originalPitch ?? 0) & 0xff);
  v.setInt8(o + 41, (h.pitchCorrection ?? 0) | 0);
  v.setUint16(o + 42, (h.link ?? 0) & 0xffff, true);
  v.setUint16(o + 44, (h.type ?? 0) & 0xffff, true);
}

/**
 * Encode a 4-char chunk id into 4 ASCII bytes.
 * @param {string} id
 * @returns {Uint8Array}
 */
function fourCC(id) {
  const b = new Uint8Array(4);
  for (let i = 0; i < 4; i++) b[i] = id.charCodeAt(i) & 0xff;
  return b;
}

/**
 * Build a leaf chunk: [id][u32 size][data][pad?].
 * @param {string} id
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
function chunk(id, data) {
  const pad = data.length & 1 ? 1 : 0;
  const out = new Uint8Array(8 + data.length + pad);
  out.set(fourCC(id), 0);
  new DataView(out.buffer).setUint32(4, data.length >>> 0, true); // size excludes header + pad
  out.set(data, 8);
  // pad byte already zero
  return out;
}

/**
 * Build a LIST chunk: [LIST][u32 size][listType][contents...][pad?].
 * `size` covers listType + contents (SF2/RIFF convention).
 * @param {string} listType
 * @param {Uint8Array} contents
 * @returns {Uint8Array}
 */
function listChunk(listType, contents) {
  const body = new Uint8Array(4 + contents.length);
  body.set(fourCC(listType), 0);
  body.set(contents, 4);
  const pad = body.length & 1 ? 1 : 0;
  const out = new Uint8Array(8 + body.length + pad);
  out.set(fourCC("LIST"), 0);
  new DataView(out.buffer).setUint32(4, body.length >>> 0, true);
  out.set(body, 8);
  return out;
}

/**
 * INFO fields in SF2 order → their metaData keys and encodings.
 * Used only when a raw INFO chunk is not available on `font.chunk`.
 */
function buildInfoFromMetaData(meta) {
  const sink = new ByteSink();
  /** @param {string} id @param {Uint8Array} data */
  const emit = (id, data) => sink.push(chunk(id, data));

  /** ZSTR: NUL-terminated, word-aligned (even length; pad handled by chunk()). */
  const zstr = (str) => {
    const s = String(str ?? "");
    const bytes = new Uint8Array(s.length + 1);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    return bytes; // trailing NUL already present; chunk() pads odd length
  };

  // ifil — version (2x u16: major, minor). Default 2.1 if absent.
  const ver = String(meta?.version ?? "2.1").split(".");
  const ifil = new Uint8Array(4);
  const vv = new DataView(ifil.buffer);
  vv.setUint16(0, (parseInt(ver[0], 10) || 2) & 0xffff, true);
  vv.setUint16(2, (parseInt(ver[1], 10) || 1) & 0xffff, true);
  emit("ifil", ifil);

  if (meta?.soundEngine != null) emit("isng", zstr(meta.soundEngine));
  if (meta?.name != null) emit("INAM", zstr(meta.name));
  if (meta?.rom != null) emit("irom", zstr(meta.rom));
  if (meta?.romVersion != null) {
    const rv = String(meta.romVersion).split(".");
    const iver = new Uint8Array(4);
    const rvv = new DataView(iver.buffer);
    rvv.setUint16(0, (parseInt(rv[0], 10) || 0) & 0xffff, true);
    rvv.setUint16(2, (parseInt(rv[1], 10) || 0) & 0xffff, true);
    emit("iver", iver);
  }
  if (meta?.creationDate != null) emit("ICRD", zstr(meta.creationDate));
  if (meta?.author != null) emit("IENG", zstr(meta.author));
  if (meta?.product != null) emit("IPRD", zstr(meta.product));
  if (meta?.copyright != null) emit("ICOP", zstr(meta.copyright));
  if (meta?.comments != null) emit("ICMT", zstr(meta.comments));
  if (meta?.createdBy != null) emit("ISFT", zstr(meta.createdBy));

  return sink.concat();
}

/**
 * Extract the raw INFO LIST contents (listType + sub-chunks) byte-identically from a parsed
 * soundfont2 raw chunk tree, if present. Returns null if unavailable.
 * @param {any} font
 * @returns {Uint8Array | null}
 */
function rawInfoContents(font) {
  const root = font?.chunk;
  if (!root || !Array.isArray(root.subChunks)) return null;
  const info = root.subChunks.find((c) => c && c.id === "LIST" && c.buffer && startsWith(c.buffer, "INFO"));
  if (!info) return null;
  // info.buffer starts at the LIST content ("INFO" + sub-chunks) and runs to end-of-parent;
  // info.length is the true content length (listType + sub-chunks).
  return info.buffer.subarray(0, info.length);
}

/** @param {Uint8Array} buf @param {string} ascii */
function startsWith(buf, ascii) {
  for (let i = 0; i < ascii.length; i++) {
    if (buf[i] !== (ascii.charCodeAt(i) & 0xff)) return false;
  }
  return true;
}

/**
 * Serialize a parsed soundfont into an SF2 RIFF file.
 * @param {any} font - a soundfont2 SoundFont2 instance, or a chunk-table structure with the same
 *   `presetData` / `sampleData` / `metaData` shape (see the input contract above).
 * @returns {ArrayBuffer}
 */
export function writeSf2(font) {
  const pd = font.presetData;
  if (!pd) throw new Error("writeSf2: font.presetData is required");

  // --- INFO LIST ---
  let infoContents = rawInfoContents(font);
  let infoChunk;
  if (infoContents) {
    // infoContents already includes the "INFO" listType prefix — emit as a LIST verbatim.
    const pad = infoContents.length & 1 ? 1 : 0;
    infoChunk = new Uint8Array(8 + infoContents.length + pad);
    infoChunk.set(fourCC("LIST"), 0);
    new DataView(infoChunk.buffer).setUint32(4, infoContents.length >>> 0, true);
    infoChunk.set(infoContents, 8);
  } else {
    infoChunk = listChunk("INFO", buildInfoFromMetaData(font.metaData));
  }

  // --- sdta LIST (smpl) ---
  // soundfont2's `sampleData` is the raw remaining RIFF buffer, NOT trimmed to the true smpl
  // length (it over-reads past the last sample into the pdta bytes). Trim to the exact PCM size:
  // sample frame offsets are in frames, so bytes = max(sampleHeader.end) * 2. `end` is NOT mutated
  // by soundfont2 (only startLoop/endLoop are), so this is the authoritative on-disk PCM length.
  const rawSamples = font.sampleData instanceof Uint8Array
    ? font.sampleData
    : new Uint8Array(font.sampleData?.buffer ?? font.sampleData ?? 0);
  let maxEndFrame = 0;
  for (const h of pd.sampleHeaders) {
    if ((h.end ?? 0) > maxEndFrame) maxEndFrame = h.end ?? 0;
  }
  const smplBytes = Math.min(rawSamples.length, maxEndFrame * 2);
  const sampleData = smplBytes > 0 ? rawSamples.subarray(0, smplBytes) : rawSamples;
  const smplChunk = chunk("smpl", sampleData);
  const sdtaChunk = listChunk("sdta", smplChunk);

  // --- pdta LIST (phdr pbag pmod pgen inst ibag imod igen shdr) ---
  const pdtaSink = new ByteSink();
  pdtaSink.push(chunk("phdr", packRecords(pd.presetHeaders, SIZE.phdr, packPhdr)));
  pdtaSink.push(chunk("pbag", packRecords(pd.presetZones, SIZE.pbag, packBag)));
  pdtaSink.push(chunk("pmod", packRecords(pd.presetModulators, SIZE.pmod, packMod)));
  pdtaSink.push(chunk("pgen", packRecords(pd.presetGenerators, SIZE.pgen, packGen)));
  pdtaSink.push(chunk("inst", packRecords(pd.instrumentHeaders, SIZE.inst, packInst)));
  pdtaSink.push(chunk("ibag", packRecords(pd.instrumentZones, SIZE.ibag, packBag)));
  pdtaSink.push(chunk("imod", packRecords(pd.instrumentModulators, SIZE.imod, packMod)));
  pdtaSink.push(chunk("igen", packRecords(pd.instrumentGenerators, SIZE.igen, packGen)));
  pdtaSink.push(chunk("shdr", packRecords(pd.sampleHeaders, SIZE.shdr, packShdr)));
  const pdtaChunk = listChunk("pdta", pdtaSink.concat());

  // --- RIFF sfbk wrapper ---
  const bodySink = new ByteSink();
  bodySink.push(fourCC("sfbk"));
  bodySink.push(infoChunk);
  bodySink.push(sdtaChunk);
  bodySink.push(pdtaChunk);
  const body = bodySink.concat();

  const out = new Uint8Array(8 + body.length);
  out.set(fourCC("RIFF"), 0);
  new DataView(out.buffer).setUint32(4, body.length >>> 0, true);
  out.set(body, 8);

  return out.buffer;
}
