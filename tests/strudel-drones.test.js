import { test } from "node:test";
import assert from "node:assert/strict";
import { DRONES, DRONE_IDS, resolveDrone } from "../js/audio/strudel/data/drones.js";
import { noteToFreq, droneRange } from "../js/audio/strudel/drones.js";

test("resolveDrone maps the 7 timed actions to themselves, unknown → null", () => {
  for (const id of ["probe", "xploit", "dump", "fetch", "mine", "lie-low", "reboot"]) {
    assert.equal(resolveDrone(id), id);
  }
  assert.equal(resolveDrone("nope"), null);
  assert.equal(resolveDrone(""), null);
  assert.equal(resolveDrone(undefined), null);
});

test("DRONE_IDS covers exactly the 7 timed actions", () => {
  assert.deepEqual([...DRONE_IDS].sort(), ["dump", "fetch", "lie-low", "mine", "probe", "reboot", "xploit"]);
});

test("noteToFreq converts note names to Hz", () => {
  assert.ok(Math.abs(noteToFreq("A4") - 440) < 0.01);
  assert.ok(Math.abs(noteToFreq("A2") - 110) < 0.01);
  assert.ok(Math.abs(noteToFreq("A1") - 55) < 0.01);
  assert.ok(Math.abs(noteToFreq("C2") - 65.41) < 0.1);
  assert.ok(Math.abs(noteToFreq("E2") - 82.41) < 0.1);
});

test("droneRange interpolates {from,to} by progress and passes numbers through", () => {
  assert.equal(droneRange({ from: 300, to: 1500 }, 0), 300);
  assert.equal(droneRange({ from: 300, to: 1500 }, 1), 1500);
  assert.equal(droneRange({ from: 300, to: 1500 }, 0.5), 900);
  assert.equal(droneRange({ from: 0, to: 10 }, 2), 10); // clamps p>1
  assert.equal(droneRange(600, 0.5), 600); // plain number
});

test("amp-LFO drones do not also declare a progress-driven gain (engine constraint)", () => {
  // The two are mutually exclusive — the amp LFO owns ampGain.gain.
  for (const [id, spec] of Object.entries(DRONES)) {
    if (spec.lfo && (spec.lfo.target ?? "amp") === "amp") {
      assert.ok(!(spec.gain && typeof spec.gain === "object"),
        `${id}: amp-LFO drone must not have a {from,to} gain`);
    }
  }
});
