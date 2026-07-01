// @ts-check
// Console commands for music control. Registered from the audio (browser) layer so
// core/headless never imports audio. Mirrors the hamburger-menu music controls for
// GUI/console symmetry. Imported once from js/ui/main.js.
//
// Engine-aware: on/off go through setMusicEnabled (which emits MUSIC_CHANGED and so drives BOTH the
// Tone renderer and the Strudel engine). Song selection (list/set/next/random/status) routes to the
// active engine — the Tone scores (audio-renderer.js) or the Strudel song manifest + MUSIC_SONG_SELECT.
import { registerCommand } from "../core/console-commands/index.js";
import { emitEvent, on, E } from "../core/events.js";
import {
  isMusicEnabled, getNowPlayingName, isRunMusicLive, setMusicEnabled,
  listScoreNames, setScoreByName, randomScore,
} from "./audio-renderer.js";
import { getAudioEngine } from "./engine-select.js";
import { SONG_MANIFEST, resolveSongQuery, songAlias } from "./strudel/songs/index.js";

function log(text, type = "meta") { emitEvent(E.LOG_ENTRY, { text, type }); }

const SUBCOMMANDS = ["status", "on", "off", "list", "next", "random", "set"];
const isStrudel = () => getAudioEngine() === "strudel";

// Track what the Strudel engine is playing (it reports via MUSIC_SONG_CHANGED); the Tone engine
// answers getNowPlayingName() directly.
let _strudelNow = null;
on(E.MUSIC_SONG_CHANGED, ({ name }) => { _strudelNow = name; });

// ---- engine-aware song helpers ----------------------------------------------------------------
/** @returns {string[]} display names of the selectable songs/scores for the active engine. */
function songNames() {
  return isStrudel() ? SONG_MANIFEST.map((e) => e.name) : listScoreNames();
}
/** @returns {string[]} last-word aliases for tab-completion. */
function aliases() {
  return isStrudel()
    ? SONG_MANIFEST.map(songAlias)
    : listScoreNames().map((n) => (n.split(/\s+/).pop() || "").toLowerCase());
}
/** What's playing now (engine-aware). @returns {string|null} */
function nowPlaying() {
  return isStrudel() ? _strudelNow : getNowPlayingName();
}
/** Switch to a random song (engine-aware, avoiding the current one where possible). @returns {string|null} name */
function selectRandom() {
  if (isStrudel()) {
    const pool = SONG_MANIFEST.filter((e) => e.name !== _strudelNow);
    const list = pool.length ? pool : SONG_MANIFEST;
    const entry = list[Math.floor(Math.random() * list.length)];
    if (!entry) return null;
    emitEvent(E.MUSIC_SONG_SELECT, { songId: entry.id });
    return entry.name;
  }
  return randomScore();
}
/** Switch to a song matching `query` (engine-aware). @returns {string|null} name */
function selectByQuery(query) {
  if (isStrudel()) {
    const entry = resolveSongQuery(query);
    if (!entry) return null;
    emitEvent(E.MUSIC_SONG_SELECT, { songId: entry.id });
    return entry.name;
  }
  return setScoreByName(query);
}

function showStatus() {
  if (!isMusicEnabled()) { log("[MUSIC] off"); return; }
  const now = nowPlaying();
  log(now ? `[MUSIC] playing: ${now}` : "[MUSIC] on (idle — click in to start)");
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
    // Strudel selection applies immediately; Tone scores apply to the next run unless one is live.
    const pending = isStrudel() ? "" : (isRunMusicLive() ? "" : " (applies to your next run)");
    if (sub === "next" || sub === "random") {
      const name = selectRandom();
      if (name) log(`[MUSIC] switched to: ${name}${pending}`);
      else log("[MUSIC] no songs available", "error");
      return;
    }
    // `music set <name>` or the shorthand `music <name>`
    const query = (sub === "set" ? args.slice(1) : args).join(" ");
    if (!query) { log("Usage: music [status | on | off | list | next | set <name> | <name>]", "error"); return; }
    const name = selectByQuery(query);
    if (name) log(`[MUSIC] song: ${name}${pending}`);
    else log(`[MUSIC] no song matching "${query}" — try: music list`, "error");
  },
});
