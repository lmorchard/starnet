// @ts-check
// Console commands for music control. Registered from the audio (browser) layer so
// core/headless never imports audio. Mirrors the hamburger-menu music controls for
// GUI/console symmetry. Imported once from js/ui/main.js.
import { registerCommand } from "../core/console-commands/index.js";
import { emitEvent, E } from "../core/events.js";
import {
  isMusicEnabled, getNowPlayingName, isRunMusicLive, setMusicEnabled,
  listScoreNames, setScoreByName, randomScore,
} from "./audio-renderer.js";

function log(text, type = "meta") { emitEvent(E.LOG_ENTRY, { text, type }); }

const SUBCOMMANDS = ["status", "on", "off", "list", "next", "random", "set"];
/** Short single-word alias per score (its last word), e.g. "Corporate — Neon" → "neon". */
const aliases = () => listScoreNames().map((n) => (n.split(/\s+/).pop() || "").toLowerCase());

function showStatus() {
  if (!isMusicEnabled()) { log("[MUSIC] off"); return; }
  const now = getNowPlayingName();
  log(now ? `[MUSIC] playing: ${now}` : "[MUSIC] on (idle — click in to start)");
}

registerCommand({
  verb: "music",
  complete(args, partial) {
    const p = partial.toLowerCase();
    // first token: subcommands + score aliases; after `set`: score aliases only
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
      log("[MUSIC] scores:");
      listScoreNames().forEach((n, i) => log(`  [${i + 1}] ${n}`));
      return;
    }
    const pending = isRunMusicLive() ? "" : " (applies to your next run)";
    if (sub === "next" || sub === "random") {
      const name = randomScore();
      if (name) log(`[MUSIC] switched to: ${name}${pending}`);
      else log("[MUSIC] no scores available", "error");
      return;
    }
    // `music set <name>` or the shorthand `music <name>`
    const query = (sub === "set" ? args.slice(1) : args).join(" ");
    if (!query) { log("Usage: music [status | on | off | list | next | set <name> | <name>]", "error"); return; }
    const name = setScoreByName(query);
    if (name) log(`[MUSIC] score: ${name}${pending}`);
    else log(`[MUSIC] no score matching "${query}" — try: music list`, "error");
  },
});
