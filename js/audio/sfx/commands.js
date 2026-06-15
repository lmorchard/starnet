// @ts-check
// Console command for SFX control. Registered from the audio (browser) layer so core/headless
// never imports audio. Mirrors `music-commands.js` and the SFX menu toggle (GUI/console symmetry).
import { registerCommand } from "../../core/console-commands/index.js";
import { emitEvent, E } from "../../core/events.js";
import { isSfxEnabled, setSfxEnabled, listCues, playCue } from "./renderer.js";

function log(text, type = "meta") { emitEvent(E.LOG_ENTRY, { text, type }); }

registerCommand({
  verb: "sfx",
  complete(args, partial) {
    const subs = ["status", "on", "off", "list", "test"];
    const p = partial.toLowerCase();
    const pool = args.length === 0 ? subs : (args[0] === "test" ? listCues() : []);
    const matches = pool.filter((s) => s.toLowerCase().startsWith(p));
    return matches.length ? { insertTexts: matches, displayTexts: matches } : null;
  },
  execute(args) {
    const sub = (args[0] || "").toLowerCase();
    if (!sub || sub === "status") { log(`[SFX] ${isSfxEnabled() ? "on" : "off"}`); return; }
    if (sub === "on")  { setSfxEnabled(true);  log("[SFX] on"); return; }
    if (sub === "off") { setSfxEnabled(false); log("[SFX] off"); return; }
    if (sub === "list") {
      log("[SFX] cues:");
      listCues().forEach((id) => log(`  ${id}`));
      return;
    }
    if (sub === "test") {
      const id = args[1];
      if (!id) { log("Usage: sfx test <cue> — see `sfx list`", "error"); return; }
      if (!listCues().includes(id)) { log(`[SFX] no cue "${id}" — try: sfx list`, "error"); return; }
      playCue(id);
      log(`[SFX] ▶ ${id}`);
      return;
    }
    log("Usage: sfx [status | on | off | list | test <cue>]", "error");
  },
});
