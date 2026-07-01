import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initGame, getState, serializeState, deserializeState } from "../js/core/state.js";
import { addHeat, decayHeat } from "../js/core/state/flow.js";
import { recordHeat, startHeatDecay, handleHeatDecay } from "../js/core/alert.js";
import { HEAT_ALARM_THRESHOLD, HEAT_DISCHARGE_FRAC, HEAT_COST } from "../js/core/balance.js";
import { applyCombatResult } from "../js/core/combat.js";
import { heatGaugeSvg } from "../js/ui/indicator-glyphs.js";
import { on, clearHandlers, E } from "../js/core/events.js";
import { clearAll, tick, TIMER } from "../js/core/timers.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";

afterEach(() => { clearHandlers(); clearAll(); });

/** Force the run's threat grade so the heat threshold is deterministic. */
function setThreat(grade) { getState().spec = { ...(getState().spec ?? {}), threat: grade }; }

describe("heat — decaying meter", () => {
  it("addHeat accumulates; decayHeat floors at 0", () => {
    initGame(() => buildCorporateExchange(), "heat-1");
    assert.equal(getState().heat, 0);
    assert.equal(addHeat(3), 3);
    decayHeat(1);
    assert.equal(getState().heat, 2);
    decayHeat(99);
    assert.equal(getState().heat, 0, "never goes negative");
  });

  it("heat + heatDecayTimerId survive a round-trip; a pre-field save heals", () => {
    initGame(() => buildCorporateExchange(), "heat-2");
    addHeat(4);
    startHeatDecay();
    const snap = JSON.parse(JSON.stringify(serializeState()));
    deserializeState(snap);
    assert.equal(getState().heat, 4);
    assert.notEqual(getState().heatDecayTimerId, null, "decay timer id round-trips");

    delete snap.heat; delete snap.heatDecayTimerId;
    deserializeState(snap);
    assert.equal(getState().heat, 0, "heat heals to 0");
    assert.equal(getState().heatDecayTimerId, null, "heatDecayTimerId heals to null");
  });

  it("the HEAT_DECAY timer bleeds heat down over ticks", () => {
    initGame(() => buildCorporateExchange(), "heat-3");
    on(TIMER.HEAT_DECAY, () => handleHeatDecay()); // engine wiring, mirrored in the test
    addHeat(5);
    startHeatDecay();
    const before = getState().heat;
    tick(30); // 30 ticks = 3s ≥ several decay intervals
    assert.ok(getState().heat < before, "heat decayed over time");
  });
});

describe("heat — trip-line ratchet", () => {
  it("a single spike over the hidden threshold steps the alert up once and discharges heat", () => {
    initGame(() => buildCorporateExchange(), "heat-4");
    setThreat("C");
    const threshold = HEAT_ALARM_THRESHOLD.C;
    assert.equal(getState().globalAlert, "green");
    recordHeat(threshold + 2); // spike over the bar
    assert.equal(getState().globalAlert, "yellow", "one step up");
    assert.ok(getState().heat < threshold, "heat discharged below the bar so it must rebuild");
    assert.ok(getState().heat <= threshold * HEAT_DISCHARGE_FRAC + 0.001, "discharged to ~threshold*frac");
  });

  it("paced activity under the threshold never trips the alert", () => {
    initGame(() => buildCorporateExchange(), "heat-5");
    setThreat("C");
    on(TIMER.HEAT_DECAY, () => handleHeatDecay());
    startHeatDecay();
    for (let i = 0; i < 5; i++) { recordHeat(1); tick(20); } // small adds, cooling between
    assert.equal(getState().globalAlert, "green", "spread out = stays cool");
  });

  it("repeated over-threshold trips climb to trace and start the countdown", () => {
    initGame(() => buildCorporateExchange(), "heat-6");
    setThreat("C");
    const over = () => recordHeat(HEAT_ALARM_THRESHOLD.C + 5);
    over(); assert.equal(getState().globalAlert, "yellow");
    over(); assert.equal(getState().globalAlert, "red");
    over();
    assert.equal(getState().globalAlert, "trace");
    assert.notEqual(getState().traceSecondsRemaining, null, "trace countdown started");
  });

  it("per-network sensitivity: the same heat trips a hardened grade but not a low-threat one", () => {
    initGame(() => buildCorporateExchange(), "heat-7a");
    setThreat("S"); // low threshold (hardened)
    recordHeat(HEAT_ALARM_THRESHOLD.S + 0.5);
    assert.equal(getState().globalAlert, "yellow", "hardened grade trips");

    initGame(() => buildCorporateExchange(), "heat-7b");
    setThreat("F"); // high threshold (absorbs bursts)
    recordHeat(HEAT_ALARM_THRESHOLD.S + 0.5); // same heat, well under F's bar
    assert.equal(getState().globalAlert, "green", "low-threat grade absorbs the same burst");
  });
});

describe("heat — fed by core activity", () => {
  it("probing a node adds heat", () => {
    initGame(() => buildCorporateExchange(), "heat-probe");
    const before = getState().heat;
    getState().nodeGraph._ctx.resolveProbe("gateway"); // gateway starts unprobed
    assert.equal(getState().heat, before + HEAT_COST.probe, "probe adds heat");
  });

  it("an xploit attempt adds heat on both success and failure", () => {
    initGame(() => buildCorporateExchange(), "heat-xploit-fail");
    applyCombatResult("gateway", { name: "T" },
      { success: false, nextAlert: "yellow", prevAlert: "green", flavor: "", roll: 1, successChance: 50, matchingVulns: [] });
    assert.equal(getState().heat, HEAT_COST.xploit, "failed xploit adds heat");

    initGame(() => buildCorporateExchange(), "heat-xploit-win");
    applyCombatResult("gateway", { name: "T" },
      { success: true, prevAccess: "locked", nextAccess: "open", levelChanged: true, revealNeighbors: false, flavor: "", roll: 1, successChance: 90, matchingVulns: [], vulnsToSurface: [] });
    assert.equal(getState().heat, HEAT_COST.xploit, "successful xploit adds heat too");
  });
});

describe("heat gauge (qualitative readout)", () => {
  it("is stroke-only, deterministic, and shifts appearance cool→hot without exposing a number", () => {
    const cool = heatGaugeSvg(0);
    const hot = heatGaugeSvg(999); // clamps to full
    assert.ok(cool.startsWith("<svg"), "returns SVG markup");
    assert.equal(cool, heatGaugeSvg(0), "deterministic");
    assert.notEqual(cool, hot, "appearance changes with heat");
    // Vector-UI rule: stroke-only, no raster fills (only fill=\"none\" allowed).
    assert.ok(!/fill="#/.test(hot), "no color fills — stroke only");
    // Never renders the raw heat value as text.
    assert.ok(!/999/.test(hot), "no numeric heat leaked into the gauge");
  });
});
