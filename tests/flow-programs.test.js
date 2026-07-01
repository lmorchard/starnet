import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initGame, getState, serializeState, deserializeState } from "../js/core/state.js";
import { setFlowRevealed, flowId, addHeat } from "../js/core/state/flow.js";
import { addCapturedCredential } from "../js/core/state/player.js";
import { HEAT_COST } from "../js/core/balance.js";
import { sniffFlow, incidentFlows, replayCredential } from "../js/core/programs.js";
import { setNodeVisible, setNodeProbed } from "../js/core/state/node.js";
import { getProgramActions, getFlowChoices } from "../js/core/actions/program-actions.js";
import { getAvailableActions } from "../js/core/actions/node-actions.js";
import { isScriptAction } from "../js/core/actions/scripts.js";
import { buildActionContext, initActionDispatcher } from "../js/core/actions/action-context.js";
import { A } from "../js/core/action-ids.js";
import { clearHandlers, emitEvent } from "../js/core/events.js";
import { clearAll } from "../js/core/timers.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";

/** Reveal switch-2 and fw-1 so their incident credential flow is workable, and give it a key. */
function armCredentialFlow(key = "cred-key") {
  const s = getState();
  const cred = s.flows.find((f) => f.type === "credential");
  cred.key = key; // Phase 3 authors this into the network; set here to test sniff in isolation.
  return { cred, id: flowId(cred) };
}

afterEach(() => { clearHandlers(); clearAll(); });

describe("flow programs — data shape + serialization", () => {
  it("Flow.key / revealed, capturedCredentials, and heat survive a round-trip", () => {
    initGame(() => buildCorporateExchange(), "flow-seed-1");
    const s = getState();

    // The demo authors an encrypted credential flow switch-2 -> fw-1.
    const cred = s.flows.find((f) => f.type === "credential");
    assert.ok(cred, "demo network has a credential flow");
    const id = flowId(cred);

    setFlowRevealed(id);
    addCapturedCredential("test-key");
    addHeat(3);

    const snap = JSON.parse(JSON.stringify(serializeState()));
    deserializeState(snap);
    const r = getState();

    const credAfter = r.flows.find((f) => flowId(f) === id);
    assert.equal(credAfter.revealed, true, "revealed flag round-trips");
    assert.deepEqual(r.player.capturedCredentials, ["test-key"], "captured credentials round-trip");
    assert.equal(r.heat, 3, "heat round-trips");
  });

  it("heals a save that predates the new fields", () => {
    initGame(() => buildCorporateExchange(), "flow-seed-2");
    const snap = JSON.parse(JSON.stringify(serializeState()));
    delete snap.heat;
    delete snap.player.capturedCredentials;

    deserializeState(snap);
    const r = getState();
    assert.equal(r.heat, 0, "heat heals to 0");
    assert.deepEqual(r.player.capturedCredentials, [], "capturedCredentials heals to []");
  });

  it("addCapturedCredential de-dupes", () => {
    initGame(() => buildCorporateExchange(), "flow-seed-3");
    addCapturedCredential("k");
    addCapturedCredential("k");
    assert.deepEqual(getState().player.capturedCredentials, ["k"]);
  });
});

// (The old monotonic program-heat sensor tests moved to tests/heat.test.js as the
// decaying-heat trip-line ratchet — superseded by the anti-tedium arc.)

describe("SNIFF program", () => {
  it("reveals a flow, captures its credential, and adds sniff heat", () => {
    initGame(() => buildCorporateExchange(), "sniff-seed-1");
    const { cred, id } = armCredentialFlow("fw-key");
    const heatBefore = getState().heat;

    sniffFlow(getState(), cred.from, id);

    const after = getState().flows.find((f) => flowId(f) === id);
    assert.equal(after.revealed, true, "flow revealed");
    assert.deepEqual(getState().player.capturedCredentials, ["fw-key"], "credential captured");
    assert.equal(getState().heat, heatBefore + HEAT_COST.sniff, "sniff heat added");
  });

  it("sniffing a non-credential flow reveals it and adds heat but captures nothing", () => {
    initGame(() => buildCorporateExchange(), "sniff-seed-2");
    const money = getState().flows.find((f) => f.type === "money");
    const id = flowId(money);
    sniffFlow(getState(), money.from, id);
    assert.equal(getState().flows.find((f) => flowId(f) === id).revealed, true);
    assert.deepEqual(getState().player.capturedCredentials, []);
    assert.equal(getState().heat, HEAT_COST.sniff);
  });

  it("offers SNIFF as a top-level (non-script) action on a PROBED node with visible flows", () => {
    initGame(() => buildCorporateExchange(), "sniff-seed-3");
    // Preparation required: SNIFF taps a node's traffic, so the node must be probed first.
    setNodeProbed("gateway");
    const gateway = getState().nodes["gateway"];
    assert.ok(incidentFlows(getState(), "gateway").length > 0, "gateway has incident flows");
    const programs = getProgramActions(gateway, getState());
    assert.ok(programs.some((a) => a.id === A.SNIFF), "SNIFF injected on a probed node");
    assert.equal(isScriptAction(A.SNIFF), false, "SNIFF is a core verb (top-level, hosts its own picker)");
    const all = getAvailableActions(gateway, getState());
    assert.ok(all.some((a) => a.id === A.SNIFF), "SNIFF surfaces in getAvailableActions");
  });

  it("does NOT offer SNIFF on an unprobed node — SNIFF needs recon prep first, appears after PROBE", () => {
    initGame(() => buildCorporateExchange(), "sniff-seed-locked");
    const gateway = () => getState().nodes["gateway"]; // accessible + unprobed at start
    assert.equal(gateway().probed, false);
    assert.equal(getProgramActions(gateway(), getState()).some((a) => a.id === A.SNIFF), false, "not before probe");
    setNodeProbed("gateway");
    assert.ok(getProgramActions(gateway(), getState()).some((a) => a.id === A.SNIFF), "offered once probed");
  });

  it("hides flows whose other endpoint isn't revealed (fog-of-war parity with the graph)", () => {
    initGame(() => buildCorporateExchange(), "sniff-seed-fog");
    // switch-2 accessible, but fw-1 still hidden → the switch-2→fw-1 credential flow must not leak.
    setNodeVisible("switch-2", "accessible");
    assert.equal(getState().nodes["fw-1"].visibility, "hidden", "fw-1 starts hidden");
    const choices = getFlowChoices(getState().nodes["switch-2"], getState());
    assert.equal(
      choices.some((c) => c.data.type === "credential"),
      false,
      "credential flow to hidden fw-1 is not offered",
    );
    // Reveal fw-1 → the flow becomes sniffable.
    setNodeVisible("fw-1", "revealed");
    const after = getFlowChoices(getState().nodes["switch-2"], getState());
    assert.ok(after.some((c) => c.data.type === "credential"), "flow appears once fw-1 is revealed");
  });

  it("does not offer SNIFF on a node with no incident flows", () => {
    initGame(() => buildCorporateExchange(), "sniff-seed-4");
    // vault-1 has no authored flow incident to it.
    assert.equal(incidentFlows(getState(), "vault-1").length, 0);
    const programs = getProgramActions(getState().nodes["vault-1"], getState());
    assert.equal(programs.some((a) => a.id === A.SNIFF), false);
  });

  it("GUI/console parity: dispatching a sniff action produces the same state as calling sniffFlow", () => {
    // Path A: direct sniffFlow.
    initGame(() => buildCorporateExchange(), "parity-seed");
    const a = armCredentialFlow("pk");
    setNodeVisible(a.cred.from, "accessible"); // reachable endpoint
    setNodeProbed(a.cred.from);                // prep: SNIFF needs the node probed
    setNodeVisible(a.cred.to, "revealed");     // other endpoint visible (fog-of-war: both must show)
    sniffFlow(getState(), a.cred.from, a.id);
    const direct = JSON.stringify({ heat: getState().heat, creds: getState().player.capturedCredentials, revealed: getState().flows.find((f) => flowId(f) === a.id).revealed });

    // Path B: same seed, via the action dispatcher (exercises availability gating + execute).
    initGame(() => buildCorporateExchange(), "parity-seed");
    const b = armCredentialFlow("pk");
    setNodeVisible(b.cred.from, "accessible");
    setNodeProbed(b.cred.from);
    setNodeVisible(b.cred.to, "revealed");
    initActionDispatcher(buildActionContext());
    emitEvent("starnet:action", { actionId: A.SNIFF, nodeId: b.cred.from, flowId: b.id, fromConsole: true });
    const viaDispatch = JSON.stringify({ heat: getState().heat, creds: getState().player.capturedCredentials, revealed: getState().flows.find((f) => flowId(f) === b.id).revealed });

    assert.equal(viaDispatch, direct, "both channels produce identical state");
  });
});

describe("finesse access + REPLAY program", () => {
  it("fw-1 is finesse-locked: probing offers no XPLOIT, and it names its trusted credential", () => {
    initGame(() => buildCorporateExchange(), "finesse-seed-1");
    setNodeVisible("fw-1", "accessible");
    const fw = getState().nodes["fw-1"];
    assert.equal(fw.finesseLocked, true, "fw-1 is finesse-locked");
    assert.ok(fw.trustsCredential, "fw-1 names a trusted credential");
    const actions = getAvailableActions(fw, getState());
    assert.equal(actions.some((a) => a.id === A.XPLOIT), false, "no XPLOIT on a finesse node");
  });

  it("REPLAY is absent without the credential and present once captured", () => {
    initGame(() => buildCorporateExchange(), "finesse-seed-2");
    setNodeVisible("fw-1", "accessible");
    const before = getAvailableActions(getState().nodes["fw-1"], getState());
    assert.equal(before.some((a) => a.id === A.REPLAY), false, "no REPLAY without the credential");

    addCapturedCredential(getState().nodes["fw-1"].trustsCredential);
    const after = getAvailableActions(getState().nodes["fw-1"], getState());
    assert.ok(after.some((a) => a.id === A.REPLAY), "REPLAY appears once the credential is held");
  });

  it("full loop: SNIFF the credential flow → REPLAY fw-1 → owned", () => {
    initGame(() => buildCorporateExchange(), "finesse-seed-3");
    const { id } = { id: flowId(getState().flows.find((f) => f.type === "credential")) };
    setNodeVisible("switch-2", "accessible");
    setNodeVisible("fw-1", "accessible");

    // SNIFF the credential off the flow.
    sniffFlow(getState(), "switch-2", id);
    const key = getState().nodes["fw-1"].trustsCredential;
    assert.ok(getState().player.capturedCredentials.includes(key), "captured the fw-1 credential");
    const heatAfterSniff = getState().heat;

    // REPLAY it into fw-1.
    const replay = getAvailableActions(getState().nodes["fw-1"], getState()).find((a) => a.id === A.REPLAY);
    assert.ok(replay, "REPLAY available");
    replay.execute(getState().nodes["fw-1"], getState(), buildActionContext(), { nodeId: "fw-1" });

    assert.equal(getState().nodes["fw-1"].accessLevel, "owned", "fw-1 owned via replay");
    assert.equal(getState().heat, heatAfterSniff + HEAT_COST.replay, "replay heat added");
  });

  it("REPLAY without the credential is a no-op (access unchanged, no heat)", () => {
    initGame(() => buildCorporateExchange(), "finesse-seed-4");
    setNodeVisible("fw-1", "accessible");
    const before = getState().nodes["fw-1"].accessLevel;
    const heatBefore = getState().heat;
    replayCredential(getState(), "fw-1");
    assert.equal(getState().nodes["fw-1"].accessLevel, before, "access unchanged");
    assert.equal(getState().heat, heatBefore, "no heat added");
  });
});
