// @ts-check
// Regression: the playtest CLI runs ONE command per process, persisting state to
// a JSON file between invocations. Actions dispatch a "starnet:action" event that
// only executes if the unified action dispatcher (plus ICE/alert/timer handlers)
// is wired. Before the fix, the non-reset LOAD path wired only initDynamicActions()
// — never the dispatcher or timer handlers — so `target`, `probe`, `tick`, etc.
// silently no-opped in any invocation that loaded saved state (i.e. every command
// after `reset`). See scripts/lib/headless-engine.js wireRunHandlers().
//
// Honest test: drive the actual CLI across separate processes and assert the
// observable consequence (selection persists, ticks advance ICE), not internals.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../scripts/playtest.js", import.meta.url));

/** Run one CLI command against an isolated state file. */
function cli(stateFile, seed, cmd) {
  execFileSync("node", [SCRIPT, "--state", stateFile, "--seed", seed, cmd], {
    encoding: "utf8",
  });
}

/** Read the persisted state JSON. */
function loadState(stateFile) {
  return JSON.parse(readFileSync(stateFile, "utf8"));
}

test("CLI: target persists selection across a separate load-path invocation", () => {
  const dir = mkdtempSync(join(tmpdir(), "starnet-cli-"));
  const stateFile = join(dir, "state.json");
  try {
    cli(stateFile, "cli-target", "reset");
    const fresh = loadState(stateFile);
    assert.equal(fresh.selectedNodeId, null, "fresh game should have no selection");

    // Pick an accessible node (the gateway / entry) to target.
    const target = Object.values(fresh.nodes).find((n) => n.visibility === "accessible");
    assert.ok(target, "expected at least one accessible node after reset");

    cli(stateFile, "cli-target", `target ${target.id}`);
    const after = loadState(stateFile);
    assert.equal(after.selectedNodeId, target.id, "target should persist selectedNodeId");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: a timed action dispatched then ticked completes on the load path", () => {
  // End-to-end proof that the load path wires the full run-handler set: the probe
  // must dispatch (action dispatcher) AND its timed-action completion must fire
  // during tick (timer→handler wiring). currentTick advancing alone proves neither,
  // so we assert the observable outcome — the node ends up probed.
  const dir = mkdtempSync(join(tmpdir(), "starnet-cli-"));
  const stateFile = join(dir, "state.json");
  try {
    cli(stateFile, "cli-probe", "reset");
    const fresh = loadState(stateFile);
    const target = Object.values(fresh.nodes).find((n) => n.visibility === "accessible");
    assert.ok(target, "expected at least one accessible node after reset");
    assert.equal(target.probed, false, "node should start unprobed");

    cli(stateFile, "cli-probe", `target ${target.id}`);
    cli(stateFile, "cli-probe", "probe");      // dynamic command, available once selected
    cli(stateFile, "cli-probe", "tick 300");   // 30s — long enough for any grade's probe

    const after = loadState(stateFile);
    assert.equal(after.nodes[target.id].probed, true, "probe should complete via the load path");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
