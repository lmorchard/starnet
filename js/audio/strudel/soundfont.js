// @ts-nocheck
// Loads the vendored GeneralUser GS soundfont (audio-content/soundfonts/) and registers ALL of its
// presets as distinct `gus_*` named Strudel sounds — a separate, NON-FUNGIBLE instrument set, NOT
// aliased to strudel.cc's `gm_*` (deliberately: these are different sounds, do not substitute).
//
// Songs reference them via `.s("gus_warm_pad")` etc., in-game AND in strudel.cc (loading the same
// SF2), so the sound carries both ways. Clean license: audio-content/soundfonts/*.LICENSE.txt.
//
// Browser-only. Uses the bundled soundfont loader (window.__soundfonts, attached by
// js/strudel-vendor.js) + registerSound/noteToMidi (registered by initStrudel).

// Anchored to this module (not the document) so it resolves from any page location — the game at
// the site root or a preview harness under /preview/.
export const GAME_SOUNDFONT_URL = new URL("../../../audio-content/soundfonts/GeneralUser-GS.sf2", import.meta.url).href;
const PREFIX = "gus_"; // GeneralUser GS

/** Preset display name → a distinct `gus_*` sound name (lowercased, non-alnum → `_`). Exported for tests. */
export function sanitize(name, i) {
  const cleaned = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return PREFIX + (cleaned || "preset_" + i);
}

let _names = null; // registered sound names (the kosher instrument palette)

/**
 * Load the game soundfont and register every preset as a `gus_*` sound. Idempotent.
 * @param {string} [url]
 * @returns {Promise<string[]>} the registered instrument names
 */
export async function loadGameSoundfont(url = GAME_SOUNDFONT_URL) {
  if (_names) return _names;
  const sfMod = window.__soundfonts;
  const registerSound = window.registerSound;
  const noteToMidi = window.noteToMidi;
  if (!sfMod?.loadSoundfont || typeof registerSound !== "function") {
    throw new Error("[soundfont] Strudel runtime not ready (boot first)");
  }
  const sf = await sfMod.loadSoundfont(url);
  const used = new Set();
  const names = [];
  sf.presets.forEach((preset, i) => {
    let name = sanitize(preset.header?.name, i);
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
  _names = names;
  return names;
}

/** @returns {string[]} the registered `gus_*` instrument names (empty until loaded). */
export function soundfontNames() {
  return _names ? [..._names] : [];
}
