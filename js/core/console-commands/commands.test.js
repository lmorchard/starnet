// @ts-check
// Tests for console command execute() via getCommand(verb).
//
// These tests stop at the action-event boundary: they assert that commands
// dispatch the right "starnet:action" event with the right payload, and that
// invalid inputs produce error log entries without dispatching anything.
// State-change outcomes (probe results, exploit resolution, etc.) belong in
// integration.test.js.
//
// Pattern:
//   actions(() => getCommand("probe").execute(["gateway"]))
//     → captured starnet:action payloads
//   logs(() => getCommand("select").execute([]))
//     → captured E.LOG_ENTRY payloads

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { initGame, getState } from "../state.js";
import { navigateTo } from "../navigation.js";
import { addCardToHand } from "../state/player.js";
import { setNodeAccessLevel } from "../state/node.js";
import { generateExploit, exploitSortKey } from "../exploits.js";
import { clearAll } from "../timers.js";
import { on, off, E } from "../events.js";
import { getCommand, registerCommand } from "./index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function withEvents(type, fn) {
  const captured = [];
  const h = (p) => captured.push(p);
  on(type, h);
  fn();
  off(type, h);
  return captured;
}

/** Capture starnet:action events emitted during fn(). */
const actions = (fn) => withEvents("starnet:action", fn);

/** Capture LOG_ENTRY events emitted during fn(). */
const logs = (fn) => withEvents(E.LOG_ENTRY, fn);

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearAll();
  initGame(() => buildCorporateFoothold());
});

// ── Registry API ──────────────────────────────────────────────────────────────

describe("registry", () => {
  it("getCommand returns a CommandDef with execute for a known verb", () => {
    const cmd = getCommand("probe");
    assert.ok(cmd, "expected a CommandDef");
    assert.equal(cmd.verb, "probe");
    assert.equal(typeof cmd.execute, "function");
  });

  it("getCommand returns undefined for an unknown verb", () => {
    assert.equal(getCommand("xyzzy"), undefined);
  });

  it("registerCommand replaces an existing entry", () => {
    const orig = getCommand("jackout");
    let called = false;
    registerCommand({ verb: "jackout", execute() { called = true; } });
    getCommand("jackout").execute([]);
    assert.ok(called);
    registerCommand(orig); // restore
  });

  it("registerCommand override is reflected in getCommand immediately", () => {
    const orig = getCommand("deselect");
    const stub = { verb: "deselect", execute() {} };
    registerCommand(stub);
    assert.strictEqual(getCommand("deselect"), stub);
    registerCommand(orig); // restore
  });
});

// ── select ────────────────────────────────────────────────────────────────────

describe("select", () => {
  it("dispatches select with the correct nodeId", () => {
    const evts = actions(() => getCommand("select").execute(["gateway"]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "select");
    assert.equal(evts[0].nodeId, "gateway");
    assert.equal(evts[0].fromConsole, true);
  });

  it("resolves node by label prefix (case-insensitive)", () => {
    // Find whatever the gateway's label starts with
    const label = getState().nodes["gateway"].label;
    const evts = actions(() => getCommand("select").execute([label.slice(0, 4)]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].nodeId, "gateway");
  });

  it("logs error and does not dispatch when no args given", () => {
    const evts = actions(() => logs(() => getCommand("select").execute([])));
    const ls = logs(() => getCommand("select").execute([]));
    assert.ok(ls.some((l) => l.type === "error"), "expected an error log entry");
    assert.equal(evts.length, 0);
  });

  it("logs error and does not dispatch for an unknown node", () => {
    let evts;
    const ls = logs(() => {
      evts = actions(() => getCommand("select").execute(["no-such-node"]));
    });
    assert.ok(ls.some((l) => l.type === "error" && l.text.includes("no-such-node")));
    assert.equal(evts.length, 0);
  });
});

// ── deselect ──────────────────────────────────────────────────────────────────

describe("deselect", () => {
  it("dispatches deselect", () => {
    const evts = actions(() => getCommand("deselect").execute([]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "deselect");
  });
});

// ── probe ─────────────────────────────────────────────────────────────────────

describe("probe", () => {
  it("dispatches probe with an explicit node arg", () => {
    const evts = actions(() => getCommand("probe").execute(["gateway"]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "probe");
    assert.equal(evts[0].nodeId, "gateway");
  });

  it("dispatches probe using the implicitly selected node", () => {
    navigateTo("gateway");
    const evts = actions(() => getCommand("probe").execute([]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "probe");
    assert.equal(evts[0].nodeId, "gateway");
  });

  it("logs error and does not dispatch when no node is selected and no arg given", () => {
    let evts;
    const ls = logs(() => { evts = actions(() => getCommand("probe").execute([])); });
    assert.ok(ls.some((l) => l.type === "error"));
    assert.equal(evts.length, 0);
  });
});

// ── exploit ───────────────────────────────────────────────────────────────────

describe("exploit", () => {
  it("dispatches exploit in implicit form: selected node + card by 1-based index", () => {
    navigateTo("gateway");
    const card = generateExploit();
    addCardToHand(card);
    // resolveCard sorts by exploitSortKey when a node is selected, so the
    // display index of our card depends on the full hand — compute it here.
    const selectedNode = getState().nodes["gateway"];
    const sorted = [...getState().player.hand].sort(
      (a, b) => exploitSortKey(a, selectedNode) - exploitSortKey(b, selectedNode)
    );
    const idx = String(sorted.findIndex((c) => c.id === card.id) + 1);
    const evts = actions(() => getCommand("exploit").execute([idx]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "exploit");
    assert.equal(evts[0].nodeId, "gateway");
    assert.equal(evts[0].exploitId, card.id);
  });

  it("dispatches exploit in implicit form: selected node + card by id", () => {
    navigateTo("gateway");
    const card = generateExploit();
    addCardToHand(card);
    const evts = actions(() => getCommand("exploit").execute([card.id]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].exploitId, card.id);
  });

  it("dispatches exploit in explicit form: node id + card id", () => {
    const card = generateExploit();
    addCardToHand(card);
    const evts = actions(() => getCommand("exploit").execute(["gateway", card.id]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "exploit");
    assert.equal(evts[0].nodeId, "gateway");
    assert.equal(evts[0].exploitId, card.id);
  });

  it("logs usage error when single arg given with no node selected", () => {
    const ls = logs(() => getCommand("exploit").execute(["some-card"]));
    assert.ok(ls.some((l) => l.type === "error" && l.text.includes("Usage")));
  });

  it("logs error for an unknown card", () => {
    navigateTo("gateway");
    const ls = logs(() => getCommand("exploit").execute(["no-such-card"]));
    assert.ok(ls.some((l) => l.type === "error"));
  });
});

// ── reboot ────────────────────────────────────────────────────────────────────

describe("reboot", () => {
  it("logs error when node is not owned", () => {
    const ls = logs(() => getCommand("reboot").execute(["gateway"]));
    assert.ok(ls.some((l) => l.type === "error" && l.text.includes("owned")));
  });

  it("dispatches reboot when node is owned", () => {
    setNodeAccessLevel("gateway", "owned");
    const evts = actions(() => getCommand("reboot").execute(["gateway"]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "reboot");
    assert.equal(evts[0].nodeId, "gateway");
  });
});

// ── cancel-* guards ───────────────────────────────────────────────────────────
// Test the "nothing in progress" guard for each cancel command.

describe("cancel commands (nothing in progress)", () => {
  for (const [verb, expected] of [
    ["cancel-probe",   "No probe scan in progress"],
    ["cancel-exploit", "No exploit execution in progress"],
    ["cancel-read",    "No read scan in progress"],
    ["cancel-loot",    "No loot extraction in progress"],
  ]) {
    it(`${verb} logs error when ${expected.toLowerCase()}`, () => {
      const ls = logs(() => getCommand(verb).execute([]));
      assert.ok(ls.some((l) => l.type === "error" && l.text.includes(expected)),
        `expected error containing "${expected}"`);
    });

    it(`${verb} does not dispatch an action`, () => {
      const evts = actions(() => getCommand(verb).execute([]));
      assert.equal(evts.length, 0);
    });
  }
});

// ── jackout ───────────────────────────────────────────────────────────────────

describe("jackout", () => {
  it("dispatches jackout", () => {
    const evts = actions(() => getCommand("jackout").execute([]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "jackout");
  });
});

// ── status (smoke) ────────────────────────────────────────────────────────────
// Validate that each sub-command produces some output and doesn't throw.

describe("status sub-commands", () => {
  it("no arg aliases full", () => {
    const ls = logs(() => getCommand("status").execute([]));
    assert.ok(ls.some((l) => l.text.includes("## STATUS")));
  });

  it("full — produces structured output", () => {
    const ls = logs(() => getCommand("status").execute(["full"]));
    assert.ok(ls.some((l) => l.text.includes("### NETWORK")));
    assert.ok(ls.some((l) => l.text.includes("### HAND")));
  });

  it("summary — contains seed and alert level", () => {
    navigateTo("gateway");
    const s = getState();
    const ls = logs(() => getCommand("status").execute(["summary"]));
    assert.ok(ls.some((l) => l.text.includes(s.seed)));
    assert.ok(ls.some((l) => l.text.includes(s.globalAlert.toUpperCase())));
  });

  it("ice — reports ICE status", () => {
    const ls = logs(() => getCommand("status").execute(["ice"]));
    assert.ok(ls.some((l) => l.text.match(/status:.*NONE|INACTIVE|ACTIVE/)));
  });

  it("hand — reports hand size", () => {
    const card = generateExploit();
    addCardToHand(card);
    const ls = logs(() => getCommand("status").execute(["hand"]));
    assert.ok(ls.some((l) => l.text.includes(card.name)));
  });

  it("alert — reports global alert", () => {
    const ls = logs(() => getCommand("status").execute(["alert"]));
    assert.ok(ls.some((l) => l.text.includes("global:")));
  });

  it("mission — reports no active mission on fresh state", () => {
    const ls = logs(() => getCommand("status").execute(["mission"]));
    assert.ok(ls.some((l) => l.text.includes("MISSION")));
  });

  it("node <id> — reports node details", () => {
    const ls = logs(() => getCommand("status").execute(["node", "gateway"]));
    assert.ok(ls.some((l) => l.text.includes("gateway")));
    assert.ok(ls.some((l) => l.text.includes("access:")));
  });

  it("unknown noun — logs error", () => {
    const ls = logs(() => getCommand("status").execute(["bogus"]));
    assert.ok(ls.some((l) => l.type === "error"));
  });
});

// ── help ──────────────────────────────────────────────────────────────────────

describe("help", () => {
  it("produces a listing that includes key verbs", () => {
    const ls = logs(() => getCommand("help").execute([]));
    const text = ls.map((l) => l.text).join("\n");
    for (const verb of ["select", "probe", "exploit", "jackout", "status", "cheat"]) {
      assert.ok(text.includes(verb), `expected help to mention "${verb}"`);
    }
  });
});

// ── store / buy (WAN guard) ───────────────────────────────────────────────────

describe("store / buy — WAN access guard", () => {
  it("store logs error when no WAN node is selected", () => {
    const ls = logs(() => getCommand("store").execute([]));
    assert.ok(ls.some((l) => l.type === "error"));
  });

  it("buy logs error when no WAN node is selected", () => {
    const ls = logs(() => getCommand("buy").execute(["1"]));
    assert.ok(ls.some((l) => l.type === "error"));
  });

  it("store produces catalog output when WAN node is selected", () => {
    const wanId = Object.values(getState().nodes).find((n) => n.type === "wan")?.id;
    if (!wanId) return; // skip if no WAN in network
    navigateTo(wanId);
    const ls = logs(() => getCommand("store").execute([]));
    assert.ok(ls.some((l) => l.text.includes("DARKNET BROKER")));
  });
});
