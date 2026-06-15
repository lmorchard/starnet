import { test } from "node:test";
import assert from "node:assert/strict";
import { DRONES, DRONE_IDS, resolveDrone } from "../js/audio/sfx/drones.js";

const VALID_SOURCES = new Set(["sawtooth", "sine", "square", "triangle", "noise", "fm", "dual"]);
// The 7 timed actions that emit ACTION_FEEDBACK (action field) — each must have a drone.
const TIMED_ACTIONS = ["probe", "xploit", "dump", "fetch", "mine", "lie-low", "reboot"];

test("DRONE_IDS is non-empty and matches DRONES keys", () => {
  assert.ok(DRONE_IDS.length > 0);
  assert.equal(DRONE_IDS.length, Object.keys(DRONES).length);
});

test("every timed action has a drone", () => {
  for (const action of TIMED_ACTIONS) {
    assert.ok(DRONES[action], `missing drone for timed action "${action}"`);
  }
});

test("every drone has a valid source and numeric volume <= 0", () => {
  for (const [id, d] of Object.entries(DRONES)) {
    assert.ok(VALID_SOURCES.has(d.source), `drone "${id}" has invalid source "${d.source}"`);
    assert.equal(typeof d.volume, "number", `drone "${id}" volume must be a number`);
    assert.ok(d.volume <= 0, `drone "${id}" volume must be <= 0, got ${d.volume}`);
  }
});

test("range params (cutoff/detune/gain) are number or {from,to} of numbers", () => {
  for (const [id, d] of Object.entries(DRONES)) {
    for (const key of ["cutoff", "detune", "gain"]) {
      if (!(key in d)) continue;
      const v = d[key];
      if (typeof v === "object") {
        assert.equal(typeof v.from, "number", `drone "${id}" ${key}.from must be a number`);
        assert.equal(typeof v.to, "number", `drone "${id}" ${key}.to must be a number`);
      } else {
        assert.equal(typeof v, "number", `drone "${id}" ${key} must be a number or {from,to}`);
      }
    }
  }
});

test("lfo, when present, is well-formed", () => {
  for (const [id, d] of Object.entries(DRONES)) {
    if (!d.lfo) continue;
    assert.equal(typeof d.lfo.rate, "number", `drone "${id}" lfo.rate must be a number`);
    assert.equal(typeof d.lfo.depth, "number", `drone "${id}" lfo.depth must be a number`);
    assert.ok(["amp", "cutoff"].includes(d.lfo.target), `drone "${id}" lfo.target must be amp|cutoff`);
  }
});

test("amp-LFO and progress-gain are mutually exclusive (engine constraint)", () => {
  for (const [id, d] of Object.entries(DRONES)) {
    const ampLfo = d.lfo && (d.lfo.target ?? "amp") === "amp";
    const progressGain = d.gain && typeof d.gain === "object";
    assert.ok(!(ampLfo && progressGain), `drone "${id}" can't use an amp-LFO and a progress-gain at once`);
  }
});

test("resolveDrone maps timed actions to themselves and unknown actions to null", () => {
  for (const action of TIMED_ACTIONS) assert.equal(resolveDrone(action), action);
  assert.equal(resolveDrone("corrupt"), null);   // instant action — no drone
  assert.equal(resolveDrone("reboot-complete"), null);
  assert.equal(resolveDrone(undefined), null);
  assert.equal(resolveDrone(""), null);
});

test("dual-source drones carry a detune sweep (the beat that resolves to lock-on)", () => {
  for (const [id, d] of Object.entries(DRONES)) {
    if (d.source !== "dual") continue;
    assert.equal(typeof d.detune, "object", `dual drone "${id}" needs a {from,to} detune`);
  }
});
