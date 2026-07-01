// @ts-check
// Console command for audio engine selection. Registered for both engines (so you can switch
// from either). Mirrors music-commands.js. Imported once from js/ui/main.js.
import { registerCommand } from "../../core/console-commands/index.js";
import { emitEvent, E } from "../../core/events.js";
import { AUDIO_ENGINES, getAudioEngine, setAudioEngine } from "../engine-select.js";

function log(text, type = "meta") { emitEvent(E.LOG_ENTRY, { text, type }); }

registerCommand({
  verb: "audio",
  complete(args, partial) {
    const p = partial.toLowerCase();
    const pool = args.length === 0 ? ["status", "engine"]
      : (args[0] === "engine" ? [...AUDIO_ENGINES] : []);
    const matches = pool.filter((s) => s.startsWith(p));
    return matches.length ? { insertTexts: matches, displayTexts: matches } : null;
  },
  execute(args) {
    const sub = (args[0] || "").toLowerCase();
    if (!sub || sub === "status") {
      log(`[AUDIO] engine: ${getAudioEngine()} (reload to apply a change)`);
      return;
    }
    if (sub === "engine") {
      const name = (args[1] || "").toLowerCase();
      if (!name) { log(`[AUDIO] engine: ${getAudioEngine()} — options: ${AUDIO_ENGINES.join(", ")}`); return; }
      const set = setAudioEngine(name);
      if (set) log(`[AUDIO] engine → ${set} — reload the page to apply.`);
      else log(`[AUDIO] unknown engine "${name}" — options: ${AUDIO_ENGINES.join(", ")}`, "error");
      return;
    }
    log("Usage: audio [status | engine <tone|strudel>]", "error");
  },
});
