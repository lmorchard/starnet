// @ts-check
// Split MuseScore_General.sf2 into small topical .sf2 files by GM instrument family.
// Each output file covers a browse-by-category authoring subset (e.g. pads, leads, drums).
//
// Preset names are kept RAW (e.g. "Halo Pad") — NOT sanitized. The loader in
// js/audio/strudel/soundfont.js applies sanitize() at load time to derive in-game
// sound names. Pre-sanitizing here would cause double-prefixing (raw "Halo Pad" is fine;
// sanitized "gus_halo_pad" fed back into sanitize() would yield "gus_gus_halo_pad").
//
// GM family index: Math.floor(preset / 8), where preset is the GM program number 0–127.
// bank === 128 marks drum kits (General MIDI standard).
//
// Taxonomy (8 topical sets):
//   MuseScore-Pad.sf2    — family 11 (Synth Pad)
//   MuseScore-Lead.sf2   — family 10 (Synth Lead)
//   MuseScore-FX.sf2     — families 12 (Synth FX) or 15 (Sound FX)
//   MuseScore-Bass.sf2   — family 4  (Bass)
//   MuseScore-Keys.sf2   — (family 0 excluding grands/honky) OR family 1 (Chromatic Perc)
//   MuseScore-Organ.sf2  — family 2  (Organ)
//   MuseScore-Guitar.sf2 — family 3  (Guitar)
//   MuseScore-Drums.sf2  — bank === 128 (drum kits)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sf2pkg from "soundfont2";
const { SoundFont2 } = sf2pkg;
import { prunePresets } from "../js/audio/soundfont/sf2-prune.js";
import { writeSf2 } from "../js/audio/soundfont/sf2-writer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const SOURCE_PATH = resolve(REPO_ROOT, "audio-content/soundfonts/MuseScore_General.sf2");
const OUT_DIR = resolve(REPO_ROOT, "audio-content/soundfonts");

/**
 * @typedef {{ file: string, test: (header: { preset: number, bank: number, name: string }) => boolean }} TopicalEntry
 */

/** @type {TopicalEntry[]} */
const TOPICAL = [
  {
    file: "MuseScore-Pad.sf2",
    test: (h) => h.bank !== 128 && Math.floor(h.preset / 8) === 11,
  },
  {
    file: "MuseScore-Lead.sf2",
    test: (h) => h.bank !== 128 && Math.floor(h.preset / 8) === 10,
  },
  {
    file: "MuseScore-FX.sf2",
    test: (h) => {
      if (h.bank === 128) return false;
      const family = Math.floor(h.preset / 8);
      return family === 12 || family === 15;
    },
  },
  {
    file: "MuseScore-Bass.sf2",
    test: (h) => h.bank !== 128 && Math.floor(h.preset / 8) === 4,
  },
  {
    file: "MuseScore-Keys.sf2",
    test: (h) => {
      if (h.bank === 128) return false;
      const family = Math.floor(h.preset / 8);
      if (family === 1) return true; // Chromatic Percussion always included
      if (family === 0) return !/grand|honky/i.test(h.name ?? ""); // Piano minus grands
      return false;
    },
  },
  {
    file: "MuseScore-Organ.sf2",
    test: (h) => h.bank !== 128 && Math.floor(h.preset / 8) === 2,
  },
  {
    file: "MuseScore-Guitar.sf2",
    test: (h) => h.bank !== 128 && Math.floor(h.preset / 8) === 3,
  },
  {
    file: "MuseScore-Drums.sf2",
    test: (h) => h.bank === 128,
  },
];

/**
 * Parse the source font once and split it into topical subsets.
 */
export function main() {
  if (!existsSync(SOURCE_PATH)) {
    console.error(
      `ERROR: MuseScore_General.sf2 not found at ${SOURCE_PATH}\n` +
        "Run `make fetch-musescore-source` first to download the full source font.",
    );
    process.exit(1);
  }

  console.log(`Parsing ${SOURCE_PATH} ...`);
  const raw = new Uint8Array(readFileSync(SOURCE_PATH));
  const font = new SoundFont2(raw);

  // Collect all non-sentinel preset headers for filtering.
  // font.presets includes the EOP sentinel; skip it (name === "EOP").
  const allPresets = font.presets.filter((p) => p.header.name !== "EOP");
  console.log(`Source: ${allPresets.length} presets`);

  for (const entry of TOPICAL) {
    // Build keep-set of RAW preset names whose header passes the filter.
    // Use a Set so duplicate raw names are deduplicated naturally (unlikely but safe).
    const keepNames = new Set();
    for (const preset of allPresets) {
      const h = preset.header;
      if (entry.test({ preset: h.preset, bank: h.bank, name: h.name })) {
        keepNames.add(h.name);
      }
    }

    if (keepNames.size === 0) {
      console.warn(`[split] ${entry.file}: 0 presets matched — skipping`);
      continue;
    }

    const pruned = prunePresets(font, keepNames);
    const bytes = writeSf2(pruned);
    const outPath = resolve(OUT_DIR, entry.file);
    writeFileSync(outPath, Buffer.from(bytes));

    const mb = (bytes.byteLength / 1e6).toFixed(1);
    console.log(`[split] ${entry.file}: ${keepNames.size} presets, ${mb} MB`);
  }

  console.log("Done.");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
