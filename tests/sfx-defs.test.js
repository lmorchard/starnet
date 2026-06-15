import { test } from "node:test";
import assert from "node:assert/strict";
import { CUES, CUE_IDS } from "../js/audio/sfx/defs.js";

const VALID_KINDS = new Set(["blip", "sweep", "chord", "noise", "fm"]);

test("CUE_IDS is non-empty and matches CUES keys", () => {
  assert.ok(CUE_IDS.length > 0, "CUE_IDS must be non-empty");
  assert.equal(CUE_IDS.length, Object.keys(CUES).length);
});

test("every cue has a valid kind", () => {
  for (const [id, cue] of Object.entries(CUES)) {
    assert.ok(
      VALID_KINDS.has(cue.kind),
      `cue "${id}" has invalid kind: "${cue.kind}"`
    );
  }
});

test("blip and fm cues have a non-empty note string", () => {
  for (const [id, cue] of Object.entries(CUES)) {
    if (cue.kind === "blip" || cue.kind === "fm") {
      assert.equal(typeof cue.note, "string", `cue "${id}" note must be a string`);
      assert.ok(cue.note.length > 0, `cue "${id}" note must be non-empty`);
    }
  }
});

test("chord cues have a non-empty array of strings for notes", () => {
  for (const [id, cue] of Object.entries(CUES)) {
    if (cue.kind === "chord") {
      assert.ok(Array.isArray(cue.notes), `cue "${id}" notes must be an array`);
      assert.ok(cue.notes.length > 0, `cue "${id}" notes must be non-empty`);
      for (const note of cue.notes) {
        assert.equal(typeof note, "string", `cue "${id}" notes must be strings`);
      }
    }
  }
});

test("sweep cues have numeric from and to", () => {
  for (const [id, cue] of Object.entries(CUES)) {
    if (cue.kind === "sweep") {
      assert.equal(typeof cue.from, "number", `cue "${id}" from must be a number`);
      assert.equal(typeof cue.to, "number", `cue "${id}" to must be a number`);
    }
  }
});

test("noise cues have a numeric dur", () => {
  for (const [id, cue] of Object.entries(CUES)) {
    if (cue.kind === "noise") {
      assert.equal(typeof cue.dur, "number", `cue "${id}" dur must be a number`);
    }
  }
});

test("every cue has a numeric volume <= 0", () => {
  for (const [id, cue] of Object.entries(CUES)) {
    assert.equal(typeof cue.volume, "number", `cue "${id}" volume must be a number`);
    assert.ok(cue.volume <= 0, `cue "${id}" volume must be <= 0, got ${cue.volume}`);
  }
});

test("optional detune is numeric and reverb is boolean when present", () => {
  for (const [id, cue] of Object.entries(CUES)) {
    if ("detune" in cue) assert.equal(typeof cue.detune, "number", `cue "${id}" detune must be a number`);
    if ("reverb" in cue) assert.equal(typeof cue.reverb, "boolean", `cue "${id}" reverb must be a boolean`);
  }
});

test("chord hits/hitGap are positive numbers when present", () => {
  for (const [id, cue] of Object.entries(CUES)) {
    if ("hits" in cue) {
      assert.equal(typeof cue.hits, "number", `cue "${id}" hits must be a number`);
      assert.ok(cue.hits >= 1, `cue "${id}" hits must be >= 1`);
    }
    if ("hitGap" in cue) assert.ok(typeof cue.hitGap === "number" && cue.hitGap > 0, `cue "${id}" hitGap must be > 0`);
  }
});

test("spot-check specific cues exist with expected kinds", () => {
  assert.equal(CUES["xploit.ok"].kind, "chord");
  assert.equal(CUES["run.bricked"].kind, "fm");
  assert.equal(CUES["fetch"].kind, "noise");
  assert.equal(CUES["probe"].kind, "blip");
  assert.equal(CUES["xploit.fail"].kind, "noise");
});
