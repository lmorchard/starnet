// @ts-check
// Structural invariant: the getPrimaryIce / getPrimaryIceFromState singleton
// shim has been fully retired. ICE is resolved per-instance via
// activeIceInstances / hasActiveIce. This test scans production + test source
// and fails if any reference to the retired symbols reappears.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Repo root = parent of this test file's directory (tests/ -> repo root).
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Build the forbidden symbol regex from fragments so this file does not match
// its own scan.
const FORBIDDEN = new RegExp("getPrimary" + "Ice(FromState)?");

// This file deliberately references the forbidden name in prose/regex, so
// exclude it from the scan by basename.
const SELF = basename(fileURLToPath(import.meta.url));

function* jsFiles(dir) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === "dist" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* jsFiles(p);
    else if (e.endsWith(".js")) yield p;
  }
}

test("getPrimaryIce / getPrimaryIceFromState references are fully retired", () => {
  const offenders = [];
  for (const root of ["js", "scripts", "tests"]) {
    for (const f of jsFiles(join(REPO_ROOT, root))) {
      if (basename(f) === SELF) continue;
      const src = readFileSync(f, "utf8");
      if (FORBIDDEN.test(src)) offenders.push(f);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `getPrimary${""}Ice should be fully retired; found in:\n${offenders.join("\n")}`,
  );
});
