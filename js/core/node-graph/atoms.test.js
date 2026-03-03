import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAtom, applyAtoms } from "./atoms.js";
import { createMessage } from "./message.js";

/** @type {import('./types.js').CtxInterface} */
const nullCtx = {
  startTrace() {}, cancelTrace() {}, giveReward() {}, spawnICE() {},
  setGlobalAlert() {}, enableNode() {}, disableNode() {}, revealNode() {}, log() {},
};

// Helper: invoke an atom by name with given inputs
function invoke(name, config, attrs, message) {
  return getAtom(name)(config, attrs, message, nullCtx);
}

// ---------------------------------------------------------------------------
// relay
// ---------------------------------------------------------------------------
describe("relay atom", () => {
  it("forwards a message when forwardingEnabled is not false", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const result = invoke("relay", {}, {}, msg);
    assert.equal(result.outgoing?.length, 1);
    assert.equal(result.outgoing[0].type, "alert");
  });

  it("blocks forwarding when forwardingEnabled is false", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const result = invoke("relay", {}, { forwardingEnabled: false }, msg);
    assert.equal(result.outgoing?.length ?? 0, 0);
  });

  it("filters by type when filter config is set", () => {
    const alertMsg = createMessage({ type: "alert", origin: "A" });
    const probeMsg = createMessage({ type: "probe-noise", origin: "A" });
    const r1 = invoke("relay", { filter: "alert" }, {}, alertMsg);
    const r2 = invoke("relay", { filter: "alert" }, {}, probeMsg);
    assert.equal(r1.outgoing?.length, 1);
    assert.equal(r2.outgoing?.length ?? 0, 0);
  });

  it("drops tick messages silently", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    const result = invoke("relay", {}, {}, tick);
    assert.equal(result.outgoing?.length ?? 0, 0);
  });

  it("returns nothing for null message", () => {
    const result = invoke("relay", {}, {}, null);
    assert.deepEqual(result, {});
  });
});

// ---------------------------------------------------------------------------
// invert
// ---------------------------------------------------------------------------
describe("invert atom", () => {
  it("flips signal active from true to false", () => {
    const msg = createMessage({ type: "signal", origin: "A", payload: { active: true } });
    const result = invoke("invert", {}, {}, msg);
    assert.equal(result.outgoing?.[0].payload.active, false);
  });

  it("flips signal active from false to true", () => {
    const msg = createMessage({ type: "signal", origin: "A", payload: { active: false } });
    const result = invoke("invert", {}, {}, msg);
    assert.equal(result.outgoing?.[0].payload.active, true);
  });

  it("ignores non-signal messages", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const result = invoke("invert", {}, {}, msg);
    assert.equal(result.outgoing?.length ?? 0, 0);
  });

  it("drops tick messages silently", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    const result = invoke("invert", {}, {}, tick);
    assert.equal(result.outgoing?.length ?? 0, 0);
  });
});

// ---------------------------------------------------------------------------
// any-of
// ---------------------------------------------------------------------------
describe("any-of atom", () => {
  it("emits active:true when any listed input sends active signal", () => {
    const msg = createMessage({ type: "signal", origin: "A", payload: { active: true } });
    const result = invoke("any-of", { inputs: ["A", "B"] }, {}, msg);
    assert.equal(result.outgoing?.[0].payload.active, true);
  });

  it("emits active:false when no listed input is active", () => {
    const msg = createMessage({ type: "signal", origin: "A", payload: { active: false } });
    const result = invoke("any-of", { inputs: ["A", "B"] }, {}, msg);
    assert.equal(result.outgoing?.[0].payload.active, false);
  });

  it("ignores signals from unlisted origins", () => {
    const msg = createMessage({ type: "signal", origin: "X", payload: { active: true } });
    const result = invoke("any-of", { inputs: ["A", "B"] }, {}, msg);
    assert.equal(result.outgoing?.length ?? 0, 0);
    assert.ok(!result.attributes);
  });

  it("tracks state across calls via _anyof_state", () => {
    const msgA = createMessage({ type: "signal", origin: "A", payload: { active: true } });
    const r1 = invoke("any-of", { inputs: ["A", "B"] }, {}, msgA);
    // Now B sends false — but A is still tracked as true
    const msgB = createMessage({ type: "signal", origin: "B", payload: { active: false } });
    const r2 = invoke("any-of", { inputs: ["A", "B"] }, r1.attributes, msgB);
    assert.equal(r2.outgoing?.[0].payload.active, true);
  });
});

// ---------------------------------------------------------------------------
// all-of
// ---------------------------------------------------------------------------
describe("all-of atom", () => {
  it("emits active:false when not all inputs are active", () => {
    const msg = createMessage({ type: "signal", origin: "A", payload: { active: true } });
    const result = invoke("all-of", { inputs: ["A", "B"] }, {}, msg);
    assert.equal(result.outgoing?.[0].payload.active, false);
  });

  it("emits active:true when all listed inputs are active", () => {
    const msgA = createMessage({ type: "signal", origin: "A", payload: { active: true } });
    const r1 = invoke("all-of", { inputs: ["A", "B"] }, {}, msgA);
    const msgB = createMessage({ type: "signal", origin: "B", payload: { active: true } });
    const r2 = invoke("all-of", { inputs: ["A", "B"] }, r1.attributes, msgB);
    assert.equal(r2.outgoing?.[0].payload.active, true);
  });

  it("ignores signals from unlisted origins", () => {
    const msg = createMessage({ type: "signal", origin: "X", payload: { active: true } });
    const result = invoke("all-of", { inputs: ["A", "B"] }, {}, msg);
    assert.equal(result.outgoing?.length ?? 0, 0);
  });

  it("emits active:false when a previously true input sends false", () => {
    const msgA = createMessage({ type: "signal", origin: "A", payload: { active: true } });
    const r1 = invoke("all-of", { inputs: ["A", "B"] }, {}, msgA);
    const msgB = createMessage({ type: "signal", origin: "B", payload: { active: true } });
    const r2 = invoke("all-of", { inputs: ["A", "B"] }, r1.attributes, msgB);
    assert.equal(r2.outgoing?.[0].payload.active, true);
    // Now A goes false
    const msgA2 = createMessage({ type: "signal", origin: "A", payload: { active: false } });
    const r3 = invoke("all-of", { inputs: ["A", "B"] }, r2.attributes, msgA2);
    assert.equal(r3.outgoing?.[0].payload.active, false);
  });
});

// ---------------------------------------------------------------------------
// latch
// ---------------------------------------------------------------------------
describe("latch atom", () => {
  it("sets latched:true on set message", () => {
    const msg = createMessage({ type: "set", origin: "A" });
    const result = invoke("latch", {}, {}, msg);
    assert.equal(result.attributes?.latched, true);
    assert.equal(result.outgoing?.length ?? 0, 0);
  });

  it("sets latched:false on reset message", () => {
    const msg = createMessage({ type: "reset", origin: "A" });
    const result = invoke("latch", {}, { latched: true }, msg);
    assert.equal(result.attributes?.latched, false);
  });

  it("ignores other message types", () => {
    const msg = createMessage({ type: "signal", origin: "A" });
    const result = invoke("latch", {}, {}, msg);
    assert.deepEqual(result, {});
  });
});

// ---------------------------------------------------------------------------
// clock
// ---------------------------------------------------------------------------
describe("clock atom", () => {
  it("increments counter on tick without emitting until period", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    const r1 = invoke("clock", { period: 3 }, {}, tick);
    assert.equal(r1.attributes?._clock_ticks, 1);
    assert.equal(r1.outgoing?.length ?? 0, 0);
    const r2 = invoke("clock", { period: 3 }, r1.attributes, tick);
    assert.equal(r2.attributes?._clock_ticks, 2);
    assert.equal(r2.outgoing?.length ?? 0, 0);
  });

  it("emits signal and resets counter when period reached", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    let attrs = {};
    for (let i = 0; i < 2; i++) {
      attrs = { ...attrs, ...invoke("clock", { period: 3 }, attrs, tick).attributes };
    }
    const r = invoke("clock", { period: 3 }, attrs, tick);
    assert.equal(r.outgoing?.[0].type, "signal");
    assert.equal(r.outgoing[0].payload.active, true);
    assert.equal(r.attributes?._clock_ticks, 0);
  });

  it("ignores non-tick messages", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const result = invoke("clock", { period: 3 }, {}, msg);
    assert.deepEqual(result, {});
  });
});

// ---------------------------------------------------------------------------
// delay
// ---------------------------------------------------------------------------
describe("delay atom", () => {
  it("enqueues message on non-tick input", () => {
    const msg = createMessage({ type: "alert", origin: "A", payload: { level: 2 } });
    const result = invoke("delay", { ticks: 2 }, {}, msg);
    assert.equal(result.attributes?._delay_queue.length, 1);
    assert.equal(result.attributes._delay_queue[0].remaining, 2);
    assert.equal(result.outgoing?.length ?? 0, 0);
  });

  it("does not emit until ticks are exhausted", () => {
    const msg = createMessage({ type: "signal", origin: "A", payload: { active: true } });
    let attrs = invoke("delay", { ticks: 2 }, {}, msg).attributes;
    const tick = createMessage({ type: "tick", origin: "__system__" });
    const r1 = invoke("delay", { ticks: 2 }, attrs, tick);
    assert.equal(r1.outgoing?.length ?? 0, 0);
    assert.equal(r1.attributes._delay_queue[0].remaining, 1);
    attrs = r1.attributes;
    const r2 = invoke("delay", { ticks: 2 }, attrs, tick);
    assert.equal(r2.outgoing?.length, 1);
    assert.equal(r2.outgoing[0].type, "signal");
    assert.equal(r2.attributes._delay_queue.length, 0);
  });
});

// ---------------------------------------------------------------------------
// counter
// ---------------------------------------------------------------------------
describe("counter atom", () => {
  it("does not emit until threshold reached", () => {
    const msg = createMessage({ type: "signal", origin: "A" });
    const r1 = invoke("counter", { n: 3, emits: { type: "unlock", payload: {} } }, {}, msg);
    assert.equal(r1.attributes?._counter_count, 1);
    assert.equal(r1.outgoing?.length ?? 0, 0);
  });

  it("emits configured message and resets when threshold reached", () => {
    const msg = createMessage({ type: "signal", origin: "A" });
    const config = { n: 2, emits: { type: "unlock", payload: { key: "vault" } } };
    let attrs = {};
    attrs = { ...attrs, ...invoke("counter", config, attrs, msg).attributes };
    const r = invoke("counter", config, attrs, msg);
    assert.equal(r.outgoing?.[0].type, "unlock");
    assert.equal(r.attributes?._counter_count, 0);
  });

  it("ignores tick messages", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    const result = invoke("counter", { n: 2, emits: { type: "unlock" } }, {}, tick);
    assert.deepEqual(result, {});
  });

  it("ignores messages that don't match filter config", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const result = invoke("counter", { n: 1, filter: "probe-noise", emits: { type: "alarm", payload: {} } }, {}, msg);
    assert.equal(result.attributes?._counter_count ?? 0, 0);
    assert.equal(result.outgoing?.length ?? 0, 0);
  });

  it("counts only messages matching filter config", () => {
    const probe = createMessage({ type: "probe-noise", origin: "A" });
    const config = { n: 2, filter: "probe-noise", emits: { type: "alarm", payload: {} } };
    let attrs = {};
    attrs = { ...attrs, ...invoke("counter", config, attrs, probe).attributes };
    const r = invoke("counter", config, attrs, probe);
    assert.equal(r.outgoing?.[0].type, "alarm");
  });
});

// ---------------------------------------------------------------------------
// flag
// ---------------------------------------------------------------------------
describe("flag atom", () => {
  it("sets attribute to true on any non-tick message when no 'on' filter set", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const result = invoke("flag", { attr: "alerted" }, {}, msg);
    assert.equal(result.attributes?.alerted, true);
    assert.equal(result.outgoing?.length ?? 0, 0);
  });

  it("sets attribute to configured value when message matches 'on' filter", () => {
    const msg = createMessage({ type: "heartbeat", origin: "A" });
    const result = invoke("flag", { on: "heartbeat", attr: "alive", value: 42 }, {}, msg);
    assert.equal(result.attributes?.alive, 42);
  });

  it("ignores messages that don't match 'on' filter", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const result = invoke("flag", { on: "heartbeat", attr: "alive" }, {}, msg);
    assert.deepEqual(result, {});
  });

  it("only fires when 'when' payload filter matches", () => {
    const active = createMessage({ type: "signal", origin: "A", payload: { active: true } });
    const inactive = createMessage({ type: "signal", origin: "A", payload: { active: false } });
    const r1 = invoke("flag", { on: "signal", when: { active: true }, attr: "triggered" }, {}, active);
    const r2 = invoke("flag", { on: "signal", when: { active: true }, attr: "triggered" }, {}, inactive);
    assert.equal(r1.attributes?.triggered, true);
    assert.deepEqual(r2, {});
  });

  it("ignores tick messages", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    const result = invoke("flag", { attr: "alerted" }, {}, tick);
    assert.deepEqual(result, {});
  });
});

// ---------------------------------------------------------------------------
// watchdog
// ---------------------------------------------------------------------------
describe("watchdog atom", () => {
  it("increments counter on tick without firing before period", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    const r1 = invoke("watchdog", { period: 3 }, {}, tick);
    assert.equal(r1.attributes?._watchdog_ticks, 1);
    assert.equal(r1.outgoing?.length ?? 0, 0);
  });

  it("emits 'set' and resets counter when period reached without intervening messages", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    let attrs = {};
    for (let i = 0; i < 2; i++) {
      attrs = { ...attrs, ...invoke("watchdog", { period: 3 }, attrs, tick).attributes };
    }
    const r = invoke("watchdog", { period: 3 }, attrs, tick);
    assert.equal(r.outgoing?.[0].type, "set");
    assert.equal(r.attributes?._watchdog_ticks, 0);
  });

  it("resets timer on any non-tick message", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    const hb = createMessage({ type: "heartbeat", origin: "A" });
    let attrs = {};
    // Tick twice
    attrs = { ...attrs, ...invoke("watchdog", { period: 3 }, attrs, tick).attributes };
    attrs = { ...attrs, ...invoke("watchdog", { period: 3 }, attrs, tick).attributes };
    assert.equal(attrs._watchdog_ticks, 2);
    // Non-tick message resets timer
    attrs = { ...attrs, ...invoke("watchdog", { period: 3 }, attrs, hb).attributes };
    assert.equal(attrs._watchdog_ticks, 0);
    // Tick again — period not reached
    const r = invoke("watchdog", { period: 3 }, attrs, tick);
    assert.equal(r.outgoing?.length ?? 0, 0);
  });

  it("does not fire if heartbeat arrives before period elapses", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    const hb = createMessage({ type: "heartbeat", origin: "A" });
    let attrs = {};
    // Tick 4 times with a reset at tick 2
    for (let i = 0; i < 4; i++) {
      if (i === 2) attrs = { ...attrs, ...invoke("watchdog", { period: 5 }, attrs, hb).attributes };
      attrs = { ...attrs, ...invoke("watchdog", { period: 5 }, attrs, tick).attributes };
    }
    // Only 2 ticks since last reset — period (5) not reached
    assert.ok((attrs._watchdog_ticks ?? 0) < 5);
  });
});

// ---------------------------------------------------------------------------
// applyAtoms progressive merge
// ---------------------------------------------------------------------------
describe("applyAtoms", () => {
  it("merges attribute patches progressively across atoms", () => {
    // latch then relay: relay should see the latched:true attribute the latch just set
    const msg = createMessage({ type: "set", origin: "A" });
    const result = applyAtoms(
      [{ name: "latch" }, { name: "relay" }],
      {},
      msg,
      nullCtx,
    );
    // latch sets latched:true; relay forwards the set message
    assert.equal(result.attributes.latched, true);
    assert.equal(result.outgoing.length, 1);
  });

  it("collects outgoing messages from all atoms", () => {
    // Two relay atoms on the same node — both forward
    const msg = createMessage({ type: "signal", origin: "A", payload: { active: true } });
    const result = applyAtoms(
      [{ name: "relay" }, { name: "relay" }],
      {},
      msg,
      nullCtx,
    );
    assert.equal(result.outgoing.length, 2);
  });

  it("collects qualityDeltas from tally atoms", () => {
    const msg = createMessage({ type: "probe-noise", origin: "A" });
    const result = applyAtoms(
      [{ name: "tally", quality: "probes-seen", delta: 1 }],
      {},
      msg,
      nullCtx,
    );
    assert.equal(result.qualityDeltas.length, 1);
    assert.equal(result.qualityDeltas[0].name, "probes-seen");
    assert.equal(result.qualityDeltas[0].delta, 1);
  });
});

// ---------------------------------------------------------------------------
// relay destinations override
// ---------------------------------------------------------------------------
describe("relay atom destinations override", () => {
  it("uses config.destinations when provided instead of message.destinations", () => {
    const msg = createMessage({ type: "alert", origin: "A", destinations: ["X"] });
    const result = invoke("relay", { destinations: ["Y", "Z"] }, {}, msg);
    assert.deepEqual(result.outgoing?.[0].destinations, ["Y", "Z"]);
  });

  it("uses message.destinations when config has no destinations", () => {
    const msg = createMessage({ type: "alert", origin: "A", destinations: ["X"] });
    const result = invoke("relay", {}, {}, msg);
    assert.deepEqual(result.outgoing?.[0].destinations, ["X"]);
  });

  it("allows config.destinations: null for broadcast override", () => {
    const msg = createMessage({ type: "alert", origin: "A", destinations: ["X"] });
    const result = invoke("relay", { destinations: null }, {}, msg);
    assert.equal(result.outgoing?.[0].destinations, null);
  });
});

// ---------------------------------------------------------------------------
// tally
// ---------------------------------------------------------------------------
describe("tally atom", () => {
  it("returns a qualityDelta on matching message", () => {
    const msg = createMessage({ type: "probe-noise", origin: "A" });
    const result = invoke("tally", { quality: "probes", delta: 1 }, {}, msg);
    assert.equal(result.qualityDeltas?.length, 1);
    assert.equal(result.qualityDeltas[0].name, "probes");
    assert.equal(result.qualityDeltas[0].delta, 1);
  });

  it("uses delta 1 by default", () => {
    const msg = createMessage({ type: "signal", origin: "A" });
    const result = invoke("tally", { quality: "events" }, {}, msg);
    assert.equal(result.qualityDeltas?.[0].delta, 1);
  });

  it("ignores tick messages", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    const result = invoke("tally", { quality: "events" }, {}, tick);
    assert.equal(result.qualityDeltas?.length ?? 0, 0);
  });

  it("ignores messages that don't match 'on' filter", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const result = invoke("tally", { on: "probe-noise", quality: "events" }, {}, msg);
    assert.equal(result.qualityDeltas?.length ?? 0, 0);
  });

  it("counts only messages matching 'on' filter", () => {
    const msg = createMessage({ type: "probe-noise", origin: "A" });
    const result = invoke("tally", { on: "probe-noise", quality: "events", delta: 5 }, {}, msg);
    assert.equal(result.qualityDeltas?.[0].delta, 5);
  });
});

// ---------------------------------------------------------------------------
// debounce
// ---------------------------------------------------------------------------
describe("debounce atom", () => {
  it("forwards first matching message", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const result = invoke("debounce", { ticks: 3 }, {}, msg);
    assert.equal(result.outgoing?.length, 1);
    assert.equal(result.outgoing[0].type, "alert");
    assert.equal(result.attributes?._debounce_cooldown, 3);
  });

  it("suppresses subsequent messages during cooldown", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const r1 = invoke("debounce", { ticks: 3 }, {}, msg);
    const r2 = invoke("debounce", { ticks: 3 }, r1.attributes, msg);
    assert.equal(r2.outgoing?.length ?? 0, 0);
    assert.equal(r2.attributes, undefined); // no attribute change (cooldown stays)
  });

  it("decrements cooldown on tick", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const tick = createMessage({ type: "tick", origin: "__system__" });
    let attrs = invoke("debounce", { ticks: 3 }, {}, msg).attributes;
    attrs = { ...attrs, ...invoke("debounce", { ticks: 3 }, attrs, tick).attributes };
    assert.equal(attrs._debounce_cooldown, 2);
  });

  it("forwards again after cooldown expires", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const tick = createMessage({ type: "tick", origin: "__system__" });
    let attrs = invoke("debounce", { ticks: 2 }, {}, msg).attributes;
    // Tick twice to expire cooldown
    attrs = { ...attrs, ...invoke("debounce", { ticks: 2 }, attrs, tick).attributes };
    attrs = { ...attrs, ...invoke("debounce", { ticks: 2 }, attrs, tick).attributes };
    assert.equal(attrs._debounce_cooldown, 0);
    // Now forward again
    const r = invoke("debounce", { ticks: 2 }, attrs, msg);
    assert.equal(r.outgoing?.length, 1);
  });

  it("ignores tick messages for output (only decrements cooldown)", () => {
    const tick = createMessage({ type: "tick", origin: "__system__" });
    const result = invoke("debounce", { ticks: 3 }, { _debounce_cooldown: 2 }, tick);
    assert.equal(result.outgoing?.length ?? 0, 0);
    assert.equal(result.attributes?._debounce_cooldown, 1);
  });

  it("ignores messages that don't match 'on' filter", () => {
    const msg = createMessage({ type: "alert", origin: "A" });
    const result = invoke("debounce", { on: "probe-noise", ticks: 3 }, {}, msg);
    assert.equal(result.outgoing?.length ?? 0, 0);
  });

  it("uses config.destinations override", () => {
    const msg = createMessage({ type: "alert", origin: "A", destinations: ["X"] });
    const result = invoke("debounce", { ticks: 1, destinations: ["Y"] }, {}, msg);
    assert.deepEqual(result.outgoing?.[0].destinations, ["Y"]);
  });
});
