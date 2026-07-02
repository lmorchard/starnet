// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// strudel.cc's transpiler rewrites DOUBLE-quoted string literals into mini-notation patterns. A
// double-quoted URL like "https://…/x.sf2" is therefore parsed as mini-notation and crashes on the
// "/" ([mini] parse error). The generated prebake (audio-content/strudel-prebake.js) MUST use
// single-quoted string literals only. Plain `node --check` can't catch this — it's valid JS; the
// breakage is strudel-transpiler-specific. This guard encodes the invariant: any line containing a
// double-quote must be a `//` comment (prose), never code.
test("generated prebake has no double-quoted string literals in code (strudel treats them as mini-notation)", () => {
  const src = readFileSync("audio-content/strudel-prebake.js", "utf8");
  const offenders = src
    .split("\n")
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => line.includes('"') && !line.trim().startsWith("//"));
  assert.equal(
    offenders.length,
    0,
    "prebake must use single-quoted strings (strudel parses double-quoted strings as mini-notation):\n" +
      offenders.map((o) => `  L${o.n}: ${o.line.trim()}`).join("\n"),
  );
});
