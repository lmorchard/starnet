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
//   logs(() => getCommand("target").execute([]))
//     → captured E.LOG_ENTRY payloads

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { buildNetwork as buildCorporateExchange } from "../../../data/networks/corporate-exchange.js";
import { initGame, getState, revealNeighbors } from "../state.js";
import { navigateTo } from "../navigation.js";
import { resolveNode } from "./resolvers.js";
import { cmdStatusNode } from "./cmd-status.js";
import { setNodeAccessLevel, setNodeVisible, setNodeProbed } from "../state/node.js";
import { flowId } from "../programs.js";
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
    const cmd = getCommand("xploit");
    assert.ok(cmd, "expected a CommandDef");
    assert.equal(cmd.verb, "xploit");
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
    const orig = getCommand("untarget");
    const stub = { verb: "untarget", execute() {} };
    registerCommand(stub);
    assert.strictEqual(getCommand("untarget"), stub);
    registerCommand(orig); // restore
  });
});

// ── target ────────────────────────────────────────────────────────────────────

describe("target", () => {
  it("dispatches target with the correct nodeId", () => {
    const evts = actions(() => getCommand("target").execute(["gateway"]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "target");
    assert.equal(evts[0].nodeId, "gateway");
    assert.equal(evts[0].fromConsole, true);
  });

  it("resolves node by label prefix (case-insensitive)", () => {
    // Find whatever the gateway's label starts with
    const label = getState().nodes["gateway"].label;
    const evts = actions(() => getCommand("target").execute([label.slice(0, 4)]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].nodeId, "gateway");
  });

  it("logs error and does not dispatch when no args given", () => {
    const evts = actions(() => logs(() => getCommand("target").execute([])));
    const ls = logs(() => getCommand("target").execute([]));
    assert.ok(ls.some((l) => l.type === "error"), "expected an error log entry");
    assert.equal(evts.length, 0);
  });

  it("logs error and does not dispatch for an unknown node", () => {
    let evts;
    const ls = logs(() => {
      evts = actions(() => getCommand("target").execute(["no-such-node"]));
    });
    assert.ok(ls.some((l) => l.type === "error" && l.text.includes("no-such-node")));
    assert.equal(evts.length, 0);
  });
});

// ── untarget ──────────────────────────────────────────────────────────────────

describe("untarget", () => {
  it("dispatches untarget", () => {
    const evts = actions(() => getCommand("untarget").execute([]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "untarget");
  });
});

// probe, read, loot, reconfigure, reboot — now dynamically discovered from graph.
// Static command tests removed.

// ── exploit ───────────────────────────────────────────────────────────────────

// Phase 3 (E1 combat rework): xploit is now arg-less — launches auto-burn from hoard.
// No card selection. The console verb is a no-arg dispatch to A.XPLOIT.
describe("xploit", () => {
  it("dispatches xploit on the targeted node with no card argument", () => {
    navigateTo("gateway");
    const evts = actions(() => getCommand("xploit").execute([]));
    assert.equal(evts.length, 1, "exactly one action dispatched");
    assert.equal(evts[0].actionId, "xploit");
    assert.equal(evts[0].nodeId, "gateway");
    assert.ok(!evts[0].exploitId, "no exploitId — arg-less dispatch");
  });

  it("logs 'No node targeted' error and dispatches nothing when nothing is targeted", () => {
    // No navigateTo → no targeted node
    let evts;
    const ls = logs(() => { evts = actions(() => getCommand("xploit").execute([])); });
    assert.ok(ls.some((l) => l.type === "error" && l.text.includes("No node targeted")));
    assert.equal(evts.length, 0);
  });

  it("logs error when given unexpected arguments (xploit is arg-less)", () => {
    navigateTo("gateway");
    const ls = logs(() => getCommand("xploit").execute(["some-extra-arg"]));
    assert.ok(ls.some((l) => l.type === "error"), "error logged for unexpected arg");
  });
});

// ── sniff ─────────────────────────────────────────────────────────────────────
// corporate-foothold (the default fixture above) authors no flows; corporate-exchange
// does, so sniff's positive-path tests reset to that network.

describe("sniff", () => {
  /** Target a node with a visible, sniffable credential flow. */
  function setup(seed = "sniff-console-1") {
    initGame(() => buildCorporateExchange(), seed);
    const cred = getState().flows.find((f) => f.type === "credential");
    setNodeVisible(cred.from, "accessible");
    setNodeProbed(cred.from);
    setNodeVisible(cred.to, "revealed"); // other endpoint must be visible too (fog-of-war)
    navigateTo(cred.from);
    return { cred, id: flowId(cred) };
  }

  it("with no arg, lists the targeted node's flows", () => {
    const { cred } = setup();
    const ls = logs(() => getCommand("sniff").execute([]));
    assert.ok(ls.some((l) => l.text.includes(`flows on ${cred.from}`)));
  });

  it("dispatches sniff on the targeted node when given a flow ref", () => {
    const { cred, id } = setup();
    const evts = actions(() => getCommand("sniff").execute([cred.type]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "sniff");
    assert.equal(evts[0].nodeId, cred.from);
    assert.equal(evts[0].flowId, id);
  });

  it("logs 'No node targeted' error and dispatches nothing when nothing is targeted", () => {
    let evts;
    const ls = logs(() => { evts = actions(() => getCommand("sniff").execute([])); });
    assert.ok(ls.some((l) => l.type === "error" && l.text.includes("No node targeted")));
    assert.equal(evts.length, 0);
  });
});

// ── replay ────────────────────────────────────────────────────────────────────

describe("replay", () => {
  it("dispatches replay on the targeted node", () => {
    navigateTo("gateway");
    const evts = actions(() => getCommand("replay").execute([]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "replay");
    assert.equal(evts[0].nodeId, "gateway");
  });

  it("logs 'No node targeted' error and dispatches nothing when nothing is targeted", () => {
    let evts;
    const ls = logs(() => { evts = actions(() => getCommand("replay").execute([])); });
    assert.ok(ls.some((l) => l.type === "error" && l.text.includes("No node targeted")));
    assert.equal(evts.length, 0);
  });

  it("rejects a stray positional arg instead of silently acting on it", () => {
    navigateTo("gateway");
    let evts;
    const ls = logs(() => { evts = actions(() => getCommand("replay").execute(["gateway"])); });
    assert.ok(ls.some((l) => l.type === "error"), "expected an error log entry");
    assert.equal(evts.length, 0, "must not dispatch when given a stray arg");
  });
});

// reboot, cancel-* — now dynamically discovered from graph. Static tests removed.

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
    assert.ok(ls.some((l) => l.text.includes("### HOARD")));
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

  it("hand — reports hoard (now aliases to status hoard)", () => {
    // "status hand" now shows the hoard summary, not individual card names.
    // Hoard is seeded at run-start; check that the HOARD header appears.
    const ls = logs(() => getCommand("status").execute(["hand"]));
    assert.ok(ls.some((l) => l.text.includes("HOARD")), "hand alias shows HOARD header");
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
    for (const verb of ["target", "probe", "xploit", "jackout", "status", "cheat", "exec"]) {
      assert.ok(text.includes(verb), `expected help to mention "${verb}"`);
    }
  });

  it("abort help is generic (no fragile per-verb enumeration)", () => {
    // Post timed-by-default, the abortable set is large/dynamic (probe/xploit/dump/fetch/mine/
    // lie-low/corrupt/set-piece actions — everything except involuntary reboot/volatile), so the
    // abort help must NOT enumerate specific verbs (that list rots). It describes the generic action.
    const ls = logs(() => getCommand("help").execute([]));
    const abortLine = ls.map((l) => l.text).find((t) => t.trim().startsWith("abort"));
    assert.ok(abortLine, "expected an abort line in help output");
    assert.ok(/timed action/i.test(abortLine), `expected abort line to describe the timed action: ${abortLine}`);
    assert.ok(!/\bprobe\b/.test(abortLine) && !/\bmine\b/.test(abortLine),
      `abort line should not enumerate specific verbs (rots as the abortable set grows): ${abortLine}`);
  });
});

// ── store / buy (WAN guard) ───────────────────────────────────────────────────

describe("darknet / buy — WAN access guard", () => {
  it("darknet logs error when no WAN node is selected", () => {
    const ls = logs(() => getCommand("darknet").execute([]));
    assert.ok(ls.some((l) => l.type === "error"));
  });

  it("buy logs error when no WAN node is selected", () => {
    const ls = logs(() => getCommand("buy").execute(["1"]));
    assert.ok(ls.some((l) => l.type === "error"));
  });

  it("darknet produces catalog output when WAN node is selected", () => {
    const wanId = Object.values(getState().nodes).find((n) => n.type === "wan")?.id;
    if (!wanId) return; // skip if no WAN in network
    navigateTo(wanId);
    const ls = logs(() => getCommand("darknet").execute([]));
    assert.ok(ls.some((l) => l.text.includes("DARKNET BROKER")));
  });
});

// ── exec ──────────────────────────────────────────────────────────────────────

describe("exec", () => {
  /** Own an IDS node, enable forwarding, select it — so `corrupt` is a script. */
  function selectOwnedIds() {
    const s = getState();
    const ids = Object.values(s.nodes).find((n) => n.type === "ids");
    assert.ok(ids, "fixture should have an IDS node");
    s.nodeGraph.setNodeAttr(ids.id, "accessLevel", "owned");
    s.nodeGraph.setNodeAttr(ids.id, "forwardingEnabled", true);
    s.nodes[ids.id].visibility = "accessible";
    navigateTo(ids.id);
    return ids.id;
  }

  it("`exec` with no arg lists the node's scripts", () => {
    selectOwnedIds();
    const ls = logs(() => getCommand("exec").execute([]));
    assert.ok(ls.map((l) => l.text).join("\n").includes("corrupt"));
  });

  it("`exec corrupt` dispatches the corrupt action on the selected node", () => {
    const id = selectOwnedIds();
    const evts = actions(() => getCommand("exec").execute(["corrupt"]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "corrupt");
    assert.equal(evts[0].nodeId, id);
    assert.equal(evts[0].fromConsole, true);
  });

  it("`exec bogus` logs an error and dispatches nothing", () => {
    selectOwnedIds();
    let evts;
    const ls = logs(() => { evts = actions(() => getCommand("exec").execute(["bogus"])); });
    assert.ok(ls.some((l) => l.type === "error"));
    assert.equal(evts.length, 0);
  });

  it("tab-completion returns script ids", () => {
    selectOwnedIds();
    const res = getCommand("exec").complete([], "", getState());
    assert.ok(res.insertTexts.includes("corrupt"));
  });

  it("`exec` with no node selected logs an error", () => {
    const ls = logs(() => getCommand("exec").execute([]));
    assert.ok(ls.some((l) => l.type === "error"));
  });
});

// ── actions listing groups scripts under exec ─────────────────────────────────

describe("actions listing groups scripts under exec", () => {
  it("lists `exec` and an indented `corrupt` for an owned IDS", () => {
    const s = getState();
    const ids = Object.values(s.nodes).find((n) => n.type === "ids");
    s.nodeGraph.setNodeAttr(ids.id, "accessLevel", "owned");
    s.nodeGraph.setNodeAttr(ids.id, "forwardingEnabled", true);
    s.nodes[ids.id].visibility = "accessible";
    navigateTo(ids.id);
    const text = logs(() => getCommand("actions").execute([])).map((l) => l.text).join("\n");
    assert.ok(/exec <script>/.test(text), "should advertise exec");
    assert.ok(/^\s+corrupt/m.test(text), "corrupt should be indented under exec");
  });

  it("does NOT print a bare top-level `exec` synthetic-action line", () => {
    const s = getState();
    const ids = Object.values(s.nodes).find((n) => n.type === "ids");
    s.nodeGraph.setNodeAttr(ids.id, "accessLevel", "owned");
    s.nodeGraph.setNodeAttr(ids.id, "forwardingEnabled", true);
    s.nodes[ids.id].visibility = "accessible";
    navigateTo(ids.id);
    const text = logs(() => getCommand("actions").execute([])).map((l) => l.text).join("\n");
    // the synthetic EXEC action's desc is "run a script on this node" — it must NOT appear as its own bare line
    assert.ok(!/run a script on this node/.test(text), "synthetic EXEC desc should not be printed as a bare action");
  });
});

// ── Obscured identity until probe (#121) ───────────────────────────────────────
//
// Navigating to a sig-N neighbor makes it accessible (traversal) but must NOT
// reveal its real id/label/type/grade until it is probed (or a blind exploit lands).

describe("obscured identity: navigated-but-unprobed node", () => {
  /** Reveal gateway's neighbor as sig-N, then traverse into it (accessible, unprobed). */
  function navigateToRevealedNeighbor() {
    revealNeighbors("gateway");
    const revealed = Object.values(getState().nodes).find((n) => n.visibility === "revealed");
    assert.ok(revealed, "expected a revealed neighbor after revealNeighbors");
    navigateTo(revealed.id);
    return getState().nodes[revealed.id];
  }

  it("the node is now accessible but still unprobed and aliased", () => {
    const node = navigateToRevealedNeighbor();
    assert.equal(node.visibility, "accessible");
    assert.equal(node.probed, false);
    assert.ok(node.sigAlias, "expected a sig-N alias");
  });

  it("resolves by its sig-N alias", () => {
    const node = navigateToRevealedNeighbor();
    assert.equal(resolveNode(node.sigAlias), node);
  });

  it("does NOT resolve by its real id (identity hidden until probed)", () => {
    const node = navigateToRevealedNeighbor();
    assert.equal(resolveNode(node.id), null);
  });

  it("does NOT resolve by its real label", () => {
    const node = navigateToRevealedNeighbor();
    if (!node.label || node.label === node.sigAlias) return;
    assert.equal(resolveNode(node.label), null);
  });

  it("status node shows [???], not the real type/label/grade", () => {
    const node = navigateToRevealedNeighbor();
    const text = logs(() => cmdStatusNode([node.sigAlias])).map((l) => l.text).join("\n");
    assert.ok(text.includes("[???]"), "expected obscured placeholders");
    assert.ok(!text.includes(node.type), "type must not leak");
  });
});
