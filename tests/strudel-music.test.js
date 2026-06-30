import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProgram } from "../js/audio/strudel/music.js";

// Stub Strudel runtime: chainable patterns that record their method calls, and signals whose
// .range() returns a tagged marker so we can assert which axis drives which param.
function makeStubCtx() {
  const mkPattern = (tag) => {
    const p = { __tag: tag, __chain: [] };
    for (const m of ["s", "gain", "lpf", "hpf", "room", "add", "fast", "cpm"]) {
      p[m] = (arg) => { p.__chain.push([m, arg]); return p; };
    }
    return p;
  };
  const mkSignal = (name) => ({ __sig: name, range: (lo, hi) => ({ __range: [lo, hi], __sig: name }) });
  return {
    note: (n) => mkPattern("note:" + n),
    stack: (...ps) => { const p = mkPattern("stack"); p.__layers = ps; return p; },
    progressSignal: mkSignal("progress"),
    threatSignal: mkSignal("threat"),
  };
}

function chainGet(pattern, method) {
  const hit = pattern.__chain.find(([m]) => m === method);
  return hit ? hit[1] : undefined;
}

test("a ranged param on a threat layer is driven by the threat signal", () => {
  const ctx = makeStubCtx();
  const score = { bpm: 120, layers: [{ sound: "sawtooth", note: "c2", axis: "threat", gain: [0.35, 0.85], lpf: [300, 3500] }] };
  const prog = buildProgram(score, ctx);
  const layer = prog.__layers[0];
  assert.deepEqual(chainGet(layer, "gain"), { __range: [0.35, 0.85], __sig: "threat" });
  assert.deepEqual(chainGet(layer, "lpf"), { __range: [300, 3500], __sig: "threat" });
  assert.equal(chainGet(layer, "s"), "sawtooth");
});

test("a ranged param on a progress layer is driven by the progress signal", () => {
  const ctx = makeStubCtx();
  const score = { bpm: 120, layers: [{ sound: "triangle", note: "c4", axis: "progress", gain: [0, 0.2], fast: [1, 2] }] };
  const layer = buildProgram(score, ctx).__layers[0];
  assert.deepEqual(chainGet(layer, "gain"), { __range: [0, 0.2], __sig: "progress" });
  assert.deepEqual(chainGet(layer, "fast"), { __range: [1, 2], __sig: "progress" });
});

test("a constant (non-array) param is passed through verbatim", () => {
  const ctx = makeStubCtx();
  const score = { bpm: 120, layers: [{ sound: "sine", note: "c1", axis: "base", gain: 0.2, room: 0.6 }] };
  const layer = buildProgram(score, ctx).__layers[0];
  assert.equal(chainGet(layer, "gain"), 0.2);
  assert.equal(chainGet(layer, "room"), 0.6);
});

test("addNote becomes an .add(note(signal.range)) on the layer's axis", () => {
  const ctx = makeStubCtx();
  const score = { bpm: 120, layers: [{ sound: "triangle", note: "c4", axis: "progress", addNote: [0, 12] }] };
  const layer = buildProgram(score, ctx).__layers[0];
  const added = chainGet(layer, "add");
  // .add receives a note() pattern; the note() arg should be the progress-ranged marker
  assert.ok(added && added.__tag.startsWith("note:"), "add should receive a note pattern");
});

test("tempo is set on the stack via cpm(bpm/4)", () => {
  const ctx = makeStubCtx();
  const score = { bpm: 120, layers: [{ sound: "sine", note: "c1", axis: "base", gain: 0.2 }] };
  const prog = buildProgram(score, ctx);
  assert.equal(chainGet(prog, "cpm"), 30);
});

test("stack receives one pattern per layer", () => {
  const ctx = makeStubCtx();
  const score = { bpm: 120, layers: [
    { sound: "sawtooth", note: "c2", axis: "threat", gain: 0.5 },
    { sound: "triangle", note: "c4", axis: "progress", gain: 0.3 },
  ] };
  assert.equal(buildProgram(score, ctx).__layers.length, 2);
});
