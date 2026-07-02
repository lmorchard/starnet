// @ts-check
// Console commands for music control. Registered from the audio (browser) layer so
// core/headless never imports audio. Mirrors the hamburger-menu music controls for
// GUI/console symmetry. Imported once from js/ui/main.js.
//
// On/off go through setMusicEnabled (audio-prefs → emits MUSIC_CHANGED, which drives the Strudel
// engine + HUD button). Song selection (list/set/next/random/status) uses the Strudel song
// manifest and emits MUSIC_SONG_SELECT for the engine to switch immediately.
import { registerCommand } from "../core/console-commands/index.js";
import { emitEvent, on, E } from "../core/events.js";
import { isMusicEnabled, setMusicEnabled } from "./audio-prefs.js";
import { SONG_MANIFEST, resolveSongQuery, songAlias } from "./strudel/songs/index.js";

function log(text, type = "meta") { emitEvent(E.LOG_ENTRY, { text, type }); }

const SUBCOMMANDS = ["status", "on", "off", "list", "next", "random", "set"];

// Track what the engine is playing (it reports via MUSIC_SONG_CHANGED).
let _nowPlaying = null;
on(E.MUSIC_SONG_CHANGED, ({ name }) => { _nowPlaying = name; });

/** @returns {string[]} display names of the selectable songs. */
const songNames = () => SONG_MANIFEST.map((e) => e.name);
/** @returns {string[]} last-word aliases for tab-completion. */
const aliases = () => SONG_MANIFEST.map(songAlias);

/** Switch to a random song (avoiding the current one where possible). @returns {string|null} name */
function selectRandom() {
  const pool = SONG_MANIFEST.filter((e) => e.name !== _nowPlaying);
  const list = pool.length ? pool : SONG_MANIFEST;
  const entry = list[Math.floor(Math.random() * list.length)];
  if (!entry) return null;
  emitEvent(E.MUSIC_SONG_SELECT, { songId: entry.id });
  return entry.name;
}

/** Switch to a song matching `query`. @returns {string|null} name */
function selectByQuery(query) {
  const entry = resolveSongQuery(query);
  if (!entry) return null;
  emitEvent(E.MUSIC_SONG_SELECT, { songId: entry.id });
  return entry.name;
}

function showStatus() {
  if (!isMusicEnabled()) { log("[MUSIC] off"); return; }
  log(_nowPlaying ? `[MUSIC] playing: ${_nowPlaying}` : "[MUSIC] on (idle — click in to start)");
}

registerCommand({
  verb: "music",
  complete(args, partial) {
    const p = partial.toLowerCase();
    // first token: subcommands + song aliases; after `set`: song aliases only
    const pool = args.length === 0 ? [...SUBCOMMANDS, ...aliases()]
      : (args[0] === "set" ? aliases() : []);
    const matches = pool.filter((s) => s.startsWith(p));
    return matches.length ? { insertTexts: matches, displayTexts: matches } : null;
  },
  execute(args) {
    const sub = (args[0] || "").toLowerCase();
    if (!sub || sub === "status") { showStatus(); return; }
    if (sub === "on")  { setMusicEnabled(true);  showStatus(); return; }
    if (sub === "off") { setMusicEnabled(false); log("[MUSIC] off"); return; }
    if (sub === "list") {
      log("[MUSIC] songs:");
      songNames().forEach((n, i) => log(`  [${i + 1}] ${n}`));
      return;
    }
    if (sub === "next" || sub === "random") {
      const name = selectRandom();
      if (name) log(`[MUSIC] switched to: ${name}`);
      else log("[MUSIC] no songs available", "error");
      return;
    }
    // `music set <name>` or the shorthand `music <name>`
    const query = (sub === "set" ? args.slice(1) : args).join(" ");
    if (!query) { log("Usage: music [status | on | off | list | next | set <name> | <name>]", "error"); return; }
    const name = selectByQuery(query);
    if (name) log(`[MUSIC] song: ${name}`);
    else log(`[MUSIC] no song matching "${query}" — try: music list`, "error");
  },
});
