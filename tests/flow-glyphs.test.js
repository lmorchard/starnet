// @ts-check
// Tests for flow-glyphs: pure, stroke-only vector packet glyphs per flow type.
// Mirrors the node-glyphs / ice-glyphs pure-module pattern.

import { test } from "node:test";
import assert from "node:assert/strict";

import { FLOW_TYPES, FLOW_GLYPHS, flowGlyphFor, flowSvg, drawFlowGlyph } from "../js/ui/flow-glyphs.js";

/** Minimal canvas-2d stub that records the calls drawFlowGlyph makes. */
function fakeCtx() {
  const calls = [];
  const rec = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    set strokeStyle(v) { calls.push(["strokeStyle", v]); },
    set fillStyle(v) { calls.push(["fillStyle", v]); },
    set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
    beginPath: rec("beginPath"), moveTo: rec("moveTo"), lineTo: rec("lineTo"),
    closePath: rec("closePath"), stroke: rec("stroke"), fillText: rec("fillText"),
  };
}

test("every flow type has a stroke-only glyph (no fills)", () => {
  for (const t of FLOW_TYPES) {
    const g = FLOW_GLYPHS[t];
    assert.ok(g, `missing glyph for ${t}`);
    assert.match(g.body, /stroke=/, `${t} body must stroke`);
    assert.match(g.body, /fill="none"/, `${t} body must be fill="none"`);
  }
});

test("flowSvg embeds the type's stroke color", () => {
  assert.ok(flowSvg("money").includes(FLOW_GLYPHS.money.color));
  assert.ok(flowSvg("data").includes(FLOW_GLYPHS.data.color));
});

test("encrypted render hides the type glyph behind a ? treatment", () => {
  const enc = flowSvg("money", { encrypted: true });
  assert.ok(enc.includes("?"), "encrypted glyph shows ?");
  assert.ok(!enc.includes(FLOW_GLYPHS.money.color), "encrypted glyph hides the type color");
});

test("flowGlyphFor returns a fallback for unknown types without throwing", () => {
  assert.doesNotThrow(() => flowGlyphFor("bogus"));
  assert.doesNotThrow(() => flowSvg("bogus"));
});

test("FLOW_TYPES is the five semantic types (encrypted is not a type)", () => {
  assert.deepEqual(FLOW_TYPES, ["money", "data", "audit", "control", "credential"]);
});

test("drawFlowGlyph strokes a path in the type color for every type", () => {
  for (const t of FLOW_TYPES) {
    const ctx = fakeCtx();
    drawFlowGlyph(ctx, t);
    assert.ok(ctx.calls.some((c) => c[0] === "stroke"), `${t} should stroke`);
    assert.ok(
      ctx.calls.some((c) => c[0] === "strokeStyle" && c[1] === FLOW_GLYPHS[t].color),
      `${t} should stroke in its color`,
    );
  }
});

test("drawFlowGlyph renders a ? (fillText) when encrypted, no stroke", () => {
  const ctx = fakeCtx();
  drawFlowGlyph(ctx, "money", { encrypted: true });
  assert.ok(ctx.calls.some((c) => c[0] === "fillText" && c[1] === "?"));
  assert.ok(!ctx.calls.some((c) => c[0] === "stroke"));
});

test("drawFlowGlyph no-ops for an unknown type without throwing", () => {
  const ctx = fakeCtx();
  assert.doesNotThrow(() => drawFlowGlyph(ctx, "bogus"));
  assert.ok(!ctx.calls.some((c) => c[0] === "stroke"));
});
