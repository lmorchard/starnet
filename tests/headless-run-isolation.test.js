// @ts-check
// Regression: running multiple games in one process must not leak event-bus
// listeners (or timers) across runs. Before the fix, resetGame() re-registered
// initGraphBridge()/initDynamicActions() listeners every run without clearing,
// so the Nth run was driven by N stacked copies of every bridge handler and
// progressively corrupted — the bot census reported false "stuck" results for
// every seed after the first.
//
// Honest test: run the SAME seed twice in one process and assert identical
// observable outcomes. Same seed + same network must be fully deterministic;
// any difference between run 1 and run 2 is cross-run contamination.

import { test } from "node:test";
import assert from "node:assert/strict";

import { runBot } from "../scripts/bot/run.js";
import { buildNetwork as buildCorporateFoothold } from "../data/networks/corporate-foothold.js";

test("same seed run twice in one process yields identical results", () => {
  const buildFn = () => buildCorporateFoothold();
  const seed = "isolation-seed-1";

  const first = runBot(buildFn, { seed });
  const second = runBot(buildFn, { seed });

  assert.equal(second.success, first.success, "success differs between runs");
  assert.equal(second.failReason, first.failReason, "failReason differs between runs");
  assert.equal(second.nodesOwned, first.nodesOwned, "nodesOwned differs between runs");
  assert.equal(second.autoBurns, first.autoBurns, "autoBurns differs between runs");
});

test("three consecutive runs are all identical (no progressive corruption)", () => {
  const buildFn = () => buildCorporateFoothold();
  const seed = "isolation-seed-2";

  const runs = [runBot(buildFn, { seed }), runBot(buildFn, { seed }), runBot(buildFn, { seed })];

  for (let i = 1; i < runs.length; i++) {
    assert.equal(runs[i].nodesOwned, runs[0].nodesOwned, `run ${i} nodesOwned drifted`);
    assert.equal(runs[i].success, runs[0].success, `run ${i} success drifted`);
  }
});
