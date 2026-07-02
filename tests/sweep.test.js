import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initGame, getState } from "../js/core/state.js";
import { startSweep } from "../js/core/sweep.js";
import { activeProcessOnNode } from "../js/core/processes.js";
import { getProgramActions } from "../js/core/actions/program-actions.js";
import { getAvailableActions } from "../js/core/actions/node-actions.js";
import { isScriptAction } from "../js/core/actions/scripts.js";
import { COMMANDS } from "../js/core/console-commands/commands.js";
import { buildActionContext, initActionDispatcher } from "../js/core/actions/action-context.js";
import { A } from "../js/core/action-ids.js";
import { clearHandlers, emitEvent, on, E } from "../js/core/events.js";
import { clearAll, tick } from "../js/core/timers.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";

afterEach(() => { clearHandlers(); clearAll(); });

describe("SWEEP — gate-bounded progressive flood-fill", () => {
  it("probes outward from the origin, bringing reached sig nodes fully online, then stops at a router", () => {
    initGame(() => buildCorporateExchange(), "sweep-1");
    // gateway (probe-gate) → switch-1 (router, open-gate) + wan. Sweep should probe gateway, switch-1,
    // wan, then STOP at switch-1 (a router reveals no neighbors until opened) — switch-2 stays hidden.
    let maxHeat = 0;
    on(E.HEAT_CHANGED, ({ total }) => { maxHeat = Math.max(maxHeat, total); });
    startSweep("gateway", 3);
    tick(400); // parallel probes run over real (grade-scaled) probe-time — tick well past completion

    const n = (id) => getState().nodes[id];
    // Observable: sweep propagated from origin all the way to switch-1 (two probe hops), AND
    // the router gate stopped it there — switch-2 was never revealed.
    assert.equal(n("gateway").probed, true, "origin probed");
    assert.equal(n("switch-1").probed, true, "wave propagated at least one hop past origin");
    assert.equal(n("switch-1").visibility, "accessible", "reached sig node comes fully online (connected)");
    assert.equal(n("switch-2").visibility, "hidden", "router stops the flood — switch-2 stays hidden");
    assert.ok(maxHeat >= 3, "each node hit raised cumulative heat (sweep is loud)");
    assert.equal(getState().processes.length, 0, "sweep process ended");
  });

  it("depth ceiling bounds how far it travels", () => {
    initGame(() => buildCorporateExchange(), "sweep-2");
    startSweep("gateway", 1); // origin + one child-layer, then stop
    tick(400);
    // switch-1/wan are gateway's neighbors → probed within the depth-1 layer; nothing deeper.
    assert.equal(getState().nodes["switch-1"].probed, true);
    assert.equal(getState().processes.length, 0, "ended at the depth-1 ceiling");
  });

  it("clamps depth: 0 → 1 (not 'max')", () => {
    initGame(() => buildCorporateExchange(), "sweep-depth-0");
    startSweep("gateway", 0);
    assert.equal(getState().processes[0].depthCap, 1, "depth 0 clamps to 1, not max");
  });

  it("clamps over-large depth to the ceiling", () => {
    initGame(() => buildCorporateExchange(), "sweep-depth-big");
    startSweep("gateway", 999);
    assert.ok(getState().processes[0].depthCap <= 6, "over-large depth clamps to the ceiling");
  });

  it("one sweep at a time per node", () => {
    initGame(() => buildCorporateExchange(), "sweep-3");
    startSweep("gateway", 3);
    const before = getState().processes.length;
    startSweep("gateway", 3); // second start ignored while one is active on the node
    assert.equal(getState().processes.length, before, "no duplicate sweep on the same node");
  });
});

describe("SWEEP — sweep-pulse graph stimulus", () => {
  it("a sweep-pulse starts the origin probe and stamps the cascade ttl", () => {
    initGame(() => buildCorporateExchange(), "sweep-pulse-start");
    startSweep("gateway", 2);
    assert.equal(getState().nodes["gateway"].probing, true, "origin probe started via sweep-pulse");
    assert.equal(getState().nodes["gateway"]._cascade_ttl, 2, "origin stamped with the cascade ttl");
  });
});

describe("SWEEP — action, availability, abort", () => {
  it("SWEEP is a top-level (non-script) inspector action, not buried under EXEC", () => {
    initGame(() => buildCorporateExchange(), "sweep-toplevel");
    assert.equal(isScriptAction(A.SWEEP), false, "SWEEP is a core verb → renders top-level, not under EXEC");
    const all = getAvailableActions(getState().nodes["gateway"], getState());
    assert.ok(all.some((a) => a.id === A.SWEEP), "SWEEP surfaces top-level in getAvailableActions");
  });

  it("the sweep console command tab-completes its (only) depth argument", () => {
    initGame(() => buildCorporateExchange(), "sweep-complete");
    const sweep = COMMANDS.find((c) => c.verb === "sweep");
    assert.deepEqual(sweep.complete([], "", getState()).insertTexts, ["1", "2", "3", "max"], "empty → all depths");
    assert.deepEqual(sweep.complete([], "m", getState()).insertTexts, ["max"], "'m' → max");
  });

  it("SWEEP is offered on an accessible node, and not while a sweep is already running", () => {
    initGame(() => buildCorporateExchange(), "sweep-act-1");
    const gateway = () => getState().nodes["gateway"];
    assert.ok(getProgramActions(gateway(), getState()).some((a) => a.id === A.SWEEP), "SWEEP offered");
    startSweep("gateway", 3);
    assert.equal(getProgramActions(gateway(), getState()).some((a) => a.id === A.SWEEP), false, "not while sweeping");
  });

  it("while a sweep runs, the node offers ABORT (and only ABORT + globals); ABORT ends it, keeping probed", () => {
    initGame(() => buildCorporateExchange(), "sweep-act-2");
    startSweep("gateway", 3); // wave 0 begins a real timed probe on the origin
    tick(2); // mid-sweep: the origin probe is in flight, process active
    assert.ok(activeProcessOnNode(getState(), "gateway"), "sweep still running");
    assert.equal(getState().nodes["gateway"].probing, true, "the wave's probe is in flight");
    const actions = getAvailableActions(getState().nodes["gateway"], getState());
    const abort = actions.find((a) => a.id === A.ABORT);
    assert.ok(abort, "ABORT offered during a sweep");
    assert.equal(actions.some((a) => a.id === A.SWEEP || a.id === A.PROBE), false, "node is busy — no other node verbs");
    abort.execute(getState().nodes["gateway"], getState(), buildActionContext(), { nodeId: "gateway" });
    assert.equal(activeProcessOnNode(getState(), "gateway"), false, "ABORT ended the sweep");
    assert.equal(getState().nodes["gateway"].probing, false, "ABORT cancelled the in-flight probe");
  });

  it("GUI/console parity: dispatching a sweep action starts the same sweep as startSweep", () => {
    initGame(() => buildCorporateExchange(), "sweep-act-3");
    initActionDispatcher(buildActionContext());
    emitEvent("starnet:action", { actionId: A.SWEEP, nodeId: "gateway", depth: "2", fromConsole: true });
    assert.ok(activeProcessOnNode(getState(), "gateway"), "dispatch started a sweep");
    tick(400); // let the dispatched sweep run to completion
    assert.equal(getState().nodes["gateway"].probed, true, "origin probed by the dispatched sweep");
  });
});
