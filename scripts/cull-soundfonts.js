// @ts-check
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import sf2pkg from "soundfont2";
const { SoundFont2 } = sf2pkg;
import { prunePresets } from "../js/audio/soundfont/sf2-prune.js";
import { writeSf2 } from "../js/audio/soundfont/sf2-writer.js";
import { sanitize } from "../js/audio/strudel/soundfont.js";
import { scanUsedNames, gatherContent } from "./soundfont-scan-used.js";
import { SOUNDFONTS } from "../audio-content/soundfonts/manifest.js";

/**
 * Cull one font entry down to the presets whose sanitized names are in `usedNames`.
 * The output deploy font retains RAW General MIDI preset names (e.g. "Warm Pad") — NOT sanitized.
 * The loader (js/audio/strudel/soundfont.js) applies sanitize() at load time to derive the
 * in-game sound names (e.g. "gus_warm_pad"). Storing sanitized names in the file would cause
 * sanitize() to double-prefix them (gus_warm_pad → gus_gus_warm_pad), silently breaking songs.
 *
 * @param {{ authoringPath: string, deployPath: string, prefix: string }} entry
 * @param {Set<string>} usedNames - sanitized sound names (e.g. "gus_warm_pad")
 * @returns {{ kept: string[], dropped: number, authoringBytes: number, deployBytes: number }}
 */
export function cullFont(entry, usedNames) {
  const authoringBytes = readFileSync(entry.authoringPath).length;
  const src = new SoundFont2(new Uint8Array(readFileSync(entry.authoringPath)));

  // Map each authoring preset's sanitized name to select which raw presets to keep.
  // Deduplicates the same way the loader does (append _2, _3 ... for collisions).
  const usedSanitized = new Set();
  /** @type {Set<string>} raw names to pass to prunePresets */
  const keepRawNames = new Set();

  const seenSanitized = new Set();
  src.presets.forEach((p, i) => {
    let sName = sanitize(p.header.name, i, entry.prefix);
    // Deduplicate sanitized names the same way the loader does.
    if (seenSanitized.has(sName)) {
      let n = 2;
      const base = sName;
      while (seenSanitized.has(sName)) sName = base + "_" + n++;
    }
    seenSanitized.add(sName);

    if (usedNames.has(sName) && !usedSanitized.has(sName)) {
      usedSanitized.add(sName);
      keepRawNames.add(p.header.name);
    }
  });

  // Prune to the kept raw-name set.
  // Keep raw preset names in the deploy font — the loader's sanitize() applies the prefix at load
  // time. If we renamed headers to sanitized names here, sanitize() would run again and
  // double-prefix them (e.g. "gus_warm_pad" → "gus_gus_warm_pad"), silently breaking all song refs.
  const pruned = prunePresets(src, keepRawNames);

  const bytes = writeSf2(pruned);
  writeFileSync(entry.deployPath, Buffer.from(bytes));

  // `dropped` = non-sentinel authoring presets minus kept count.
  // src.presets.length includes the EOP sentinel, so subtract 1.
  const authoringCount = src.presets.length - 1;
  const dropped = authoringCount - keepRawNames.size;

  return {
    kept: [...usedSanitized],
    dropped,
    authoringBytes,
    deployBytes: bytes.byteLength,
  };
}

/** CLI: cull every manifest font whose authoring input is present. */
export function main() {
  const content = gatherContent();
  for (const entry of SOUNDFONTS) {
    if (!existsSync(entry.authoringPath)) {
      console.log(
        `[cull] skip ${entry.prefix} — authoring font absent (${entry.authoringPath})`,
      );
      continue;
    }
    const used = scanUsedNames(content, entry.prefix, entry.allow);
    const r = cullFont(entry, used);
    console.log(
      `[cull] ${entry.prefix}: kept ${r.kept.length} (${r.kept.join(", ")}), ` +
        `dropped ${r.dropped} presets, ` +
        `${(r.authoringBytes / 1e6).toFixed(1)}MB → ${(r.deployBytes / 1e6).toFixed(2)}MB → ${entry.deployPath}`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
