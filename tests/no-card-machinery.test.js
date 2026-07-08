// @ts-check
// Structural guard for the E1 Phase 9 sweep: the old exploit-CARD model (hand,
// named cards with quality/uses/decay, per-vuln store catalog, card UI) was
// deleted in favor of the disposable exploit-round hoard + coherence auto-burn.
// This test locks that deletion in: it greps js/ and scripts/ for the retired
// card-machinery symbols and fails if any reappear in PRODUCTION source.
//
// Test files are exempt (a test may legitimately mention a symbol name as a
// string — including this very file). The check scans .js files, skipping any
// path ending in `.test.js`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// The retired card-machinery symbols. Each must have ZERO occurrences in
// production source after the Phase 9 sweep. Word-boundaried where a bare token
// would over-match (e.g. generateExploit vs generateExploitRound — n/a here, but
// defensive) and property-access-anchored for player.hand.
const FORBIDDEN = [
  "player.hand",
  "ExploitCard",
  "addCardToHand",
  "generateExploit",       // generateExploit + generateExploitForVuln (both deleted)
  "getStoreCatalog",
  "generateStartingHand",
  "buildRunHand",
  "addCardToInventory",
  "applyCardDecay",
  "reconcileHandIds",
  "exploitSortKey",
  "getExploitChoices",
  "getExploitEmptyReason",
];

/** @param {string} dir @returns {string[]} absolute paths of production .js files */
function collectJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...collectJsFiles(full));
    } else if (entry.endsWith(".js") && !entry.endsWith(".test.js")) {
      out.push(full);
    }
  }
  return out;
}

test("no card-machinery symbols remain in production js/ or scripts/", () => {
  const files = [
    ...collectJsFiles(join(ROOT, "js")),
    ...collectJsFiles(join(ROOT, "scripts")),
  ];

  /** @type {string[]} */
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      for (const sym of FORBIDDEN) {
        if (line.includes(sym)) {
          hits.push(`${file.replace(ROOT + "/", "")}:${i + 1}: ${sym} — ${line.trim()}`);
        }
      }
    });
  }

  assert.deepEqual(
    hits,
    [],
    `Card-machinery symbols reappeared in production source (Phase 9 sweep regression):\n${hits.join("\n")}`,
  );
});
