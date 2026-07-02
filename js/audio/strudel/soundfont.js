// @ts-nocheck
// Loads the game's soundfonts (per audio-content/soundfonts/manifest.js) and registers ALL of each
// font's presets as distinct `<prefix>*` named Strudel sounds — a separate, NON-FUNGIBLE instrument
// set per font, NOT aliased to strudel.cc's `gm_*` (deliberately: these are different sounds, do
// not substitute).
//
// Songs reference them via `.s("gus_warm_pad")` etc., in-game AND in strudel.cc (loading the same
// SF2), so the sound carries both ways. Clean license: audio-content/soundfonts/*.LICENSE.txt.
//
// Browser-only. Uses the bundled soundfont loader (window.__soundfonts, attached by
// js/strudel-vendor.js) + registerSound/noteToMidi (registered by initStrudel).

import { SOUNDFONTS } from "../../../audio-content/soundfonts/manifest.js";

// Resolve manifest paths (relative to project root) from this module's location.
// soundfont.js is at js/audio/strudel/, so ../../../ reaches the project root.
const _root = new URL("../../../", import.meta.url).href;

/**
 * HEAD probe used in production — checks whether a URL exists before fetching it.
 * Receives the raw manifest path; resolves it to an absolute URL via _root before fetching.
 */
async function defaultProbe(path) {
  if (typeof fetch !== "function") return false;
  try {
    const res = await fetch(_root + path, { method: "HEAD" });
    return res.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Resolve which font path to load for a manifest entry.
 * If `deployPath` is absent (e.g. a topical set shipped whole), returns `authoringPath` directly
 * without probing. When `deployPath` is present, prefers it (culled, smaller); falls back to
 * `authoringPath` if the deploy probe fails.
 * Returns the raw path string from the entry (callers prepend _root to build the final URL).
 * `probe` receives the raw path and returns true if the resource exists.
 * `probe` is injectable for tests (defaults to a real HEAD fetch in the browser).
 * @param {{ deployPath?: string, authoringPath: string }} entry
 * @param {(path: string) => Promise<boolean>} [probe]
 * @returns {Promise<string>} the resolved path (deployPath or authoringPath)
 */
export async function resolveFontUrl(entry, probe = defaultProbe) {
  if (!entry.deployPath) return entry.authoringPath;
  const ok = await probe(entry.deployPath);
  return ok ? entry.deployPath : entry.authoringPath;
}

/** Preset display name → a distinct `<prefix>*` sound name (lowercased, non-alnum → `_`). Exported for tests. */
export function sanitize(name, i, prefix) {
  const cleaned = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return prefix + (cleaned || "preset_" + i);
}

let _names = null; // registered sound names across all loaded fonts (the kosher instrument palette)

/**
 * Load all game soundfonts from the manifest and register every preset under its font's prefix.
 * Prefers each font's culled deploy file; falls back to the full authoring file.
 * Idempotent — returns the accumulated registered names on subsequent calls.
 * @returns {Promise<string[]>} all registered instrument names
 */
export async function loadGameSoundfont() {
  if (_names) return _names;
  const sfMod = window.__soundfonts;
  const registerSound = window.registerSound;
  const noteToMidi = window.noteToMidi;
  if (!sfMod?.loadSoundfont || typeof registerSound !== "function") {
    throw new Error("[soundfont] Strudel runtime not ready (boot first)");
  }

  const allNames = [];

  for (const entry of SOUNDFONTS) {
    if (entry.authoringOnly) continue; // authoring-only sets are not loaded in-game
    const path = await resolveFontUrl(entry);
    const url = _root + path;
    const sf = await sfMod.loadSoundfont(url);
    const used = new Set();
    const names = [];
    sf.presets.forEach((preset, i) => {
      let name = sanitize(preset.header?.name, i, entry.prefix);
      if (used.has(name)) { let n = 2; const base = name; while (used.has(name)) name = base + "_" + n++; }
      used.add(name);
      registerSound(
        name,
        (time, value) => {
          const ctx = window.getAudioContext();
          const note = value?.note ?? "c3";
          const midi = typeof note === "number" ? note : noteToMidi(note);
          const stop = sfMod.startPresetNote(ctx, preset, midi, time);
          // superdough bails early on a soundfont handle (node is undefined) and never schedules the
          // note-off, so the voice would ring forever — schedule it ourselves from the hap duration
          // (value.duration = hapDuration). This is what sfumato's own .soundfont() method does, and
          // it makes hush()/stop actually silence the song (voices self-terminate; no new triggers).
          const dur = typeof value?.duration === "number" ? value.duration : 0.5;
          stop(time + dur);
          return { node: undefined, stop };
        },
        { type: "soundfont", prebake: false },
      );
      names.push(name);
    });
    allNames.push(...names);
  }

  _names = allNames;
  return _names;
}

/** @returns {string[]} all registered soundfont instrument names (empty until loaded). */
export function soundfontNames() {
  return _names ? [..._names] : [];
}
