// @ts-check
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Extract all `<prefix>...` sound tokens from a blob of text, unioned with an allow list.
 * @param {string} text @param {string} prefix @param {string[]} [allow] @returns {Set<string>} */
export function scanUsedNames(text, prefix, allow = []) {
  const re = new RegExp(`\\b${prefix}[a-z0-9_]+`, "g");
  const found = new Set(text.match(re) || []);
  for (const a of allow) found.add(a);
  return found;
}

/** Concatenate the text of every song + audio-data file the scanner should search.
 * @param {string[]} [dirs] @returns {string} */
export function gatherContent(dirs = ["audio-content/songs", "js/audio/strudel/data"]) {
  let out = "";
  for (const dir of dirs) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isFile()) out += "\n" + readFileSync(join(dir, e.name), "utf8");
    }
  }
  return out;
}
