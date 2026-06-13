import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInspectorPosition } from "../js/ui/inspector-position.js";

const container = { w: 800, h: 600 };
const popup = { w: 200, h: 160 };

test("places to the right of the node when there is room", () => {
  const node = { x: 300, y: 300, r: 20 };
  const { left, onRight } = computeInspectorPosition({ node, popup, container });
  assert.equal(onRight, true);
  assert.equal(left, 300 + 20 + 40); // pos.x + r + gap
});

test("flips left when the popup would clip the right edge", () => {
  const node = { x: 760, y: 300, r: 20 };
  const { left, onRight } = computeInspectorPosition({ node, popup, container });
  assert.equal(onRight, false);
  assert.equal(left, 760 - 20 - 40 - 200); // pos.x - r - gap - w
});

test("anchors header near the node top, clamped into view", () => {
  const node = { x: 300, y: 300, r: 20 };
  const { top } = computeInspectorPosition({ node, popup, container });
  assert.equal(top, 300 - 20); // node top edge (pos.y - r)
});

test("a popup taller than the container pins to the top (header+actions stay visible)", () => {
  const node = { x: 300, y: 550, r: 20 };
  const tall = { w: 200, h: 720 };
  const { top } = computeInspectorPosition({ node, popup: tall, container });
  assert.equal(top, 4); // pinned to top margin; footer overflows the bottom by design
});

test("near the bottom edge, shifts up so the popup fits when it can", () => {
  const node = { x: 300, y: 560, r: 20 };
  const { top } = computeInspectorPosition({ node, popup, container });
  assert.equal(top, container.h - popup.h - 4); // 600 - 160 - 4 = 436
});
