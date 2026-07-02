// @ts-check
import { writeFileSync, existsSync } from "node:fs";
import { SOUNDFONTS } from "../audio-content/soundfonts/manifest.js";

/** Download each manifest font's authoring .sf2 from its `host` to `authoringPath` (skips if present). */
export async function main() {
  for (const entry of SOUNDFONTS) {
    if (!entry.host) { console.log(`[fetch] ${entry.prefix}: no host, skip`); continue; }
    if (existsSync(entry.authoringPath)) { console.log(`[fetch] ${entry.prefix}: present, skip`); continue; }
    console.log(`[fetch] ${entry.prefix}: ${entry.host} → ${entry.authoringPath}`);
    const res = await fetch(entry.host);
    if (!res.ok) throw new Error(`fetch ${entry.host} → ${res.status}`);
    writeFileSync(entry.authoringPath, Buffer.from(await res.arrayBuffer()));
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
