import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTAINER_POLYGON_POINTS,
  NODE_GLYPHS,
  FALLBACK_GLYPH,
  ALL_GLYPH_TYPES,
  glyphFor,
  glyphSvg,
  glyphDataUri,
  fenceYs,
  nodeFaceSvg,
  nodeFaceDataUri,
} from "../js/ui/node-glyphs.js";

const CORE = ["wan", "gateway", "router", "firewall", "workstation", "ids", "security-monitor", "fileserver", "cryptovault", "mine"];
const SETPIECE = ["key-server", "vault", "routing-panel", "routing-switch", "data-relay", "watchdog-daemon", "tripwire-sensor", "alarm-latch"];

test("vocabulary covers all core and set-piece types", () => {
  for (const t of [...CORE, ...SETPIECE]) {
    assert.ok(NODE_GLYPHS[t], `missing glyph for ${t}`);
  }
  assert.deepEqual(ALL_GLYPH_TYPES.sort(), [...CORE, ...SETPIECE].sort());
});

test("every glyph has a hex color and non-empty body", () => {
  for (const [type, g] of Object.entries(NODE_GLYPHS)) {
    assert.match(g.color, /^#[0-9a-f]{6}$/i, `bad color for ${type}`);
    assert.ok(g.body.length > 0, `empty body for ${type}`);
  }
});

test("container polygon is a 12-gon (24 normalized coords in [-1,1])", () => {
  const nums = CONTAINER_POLYGON_POINTS.trim().split(/\s+/).map(Number);
  assert.equal(nums.length, 24);
  for (const n of nums) assert.ok(n >= -1 && n <= 1, `${n} out of range`);
});

test("glyphFor falls back to the microchip for unknown types", () => {
  assert.equal(glyphFor("totally-unknown-type"), FALLBACK_GLYPH);
  assert.equal(glyphFor("fileserver"), NODE_GLYPHS.fileserver);
});

test("glyphSvg wraps body in a 64x64 svg with the type's stroke color", () => {
  const svg = glyphSvg("cryptovault");
  assert.ok(svg.startsWith("<svg"));
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.ok(svg.includes(NODE_GLYPHS.cryptovault.color));
  assert.ok(svg.includes(NODE_GLYPHS.cryptovault.body));
});

test("glyphDataUri returns an encoded svg data uri (no raw # )", () => {
  const uri = glyphDataUri("mine");
  assert.ok(uri.startsWith("data:image/svg+xml,"));
  assert.ok(!uri.slice("data:image/svg+xml,".length).includes("#"), "hex # must be percent-encoded");
});

test("gallery type list (ALL_GLYPH_TYPES) includes every mapped type for the preview harness", () => {
  // Guards against the preview gallery silently dropping a type as the
  // vocabulary grows. preview.js builds its gallery from ALL_GLYPH_TYPES.
  assert.ok(ALL_GLYPH_TYPES.includes("mine"), "mine must be demoable (it used to fall through to a circle)");
  assert.ok(ALL_GLYPH_TYPES.includes("alarm-latch"), "set-piece types must be demoable");
  assert.equal(ALL_GLYPH_TYPES.length, CORE.length + SETPIECE.length);
});

test("fenceYs density increases with access level", () => {
  assert.ok(fenceYs("locked").length < fenceYs("compromised").length);
  assert.ok(fenceYs("compromised").length < fenceYs("owned").length);
});

test("fenceYs is empty for an unknown access level", () => {
  assert.deepEqual(fenceYs("weird"), []);
});

test("nodeFaceSvg embeds the type glyph, a clip path, and fence lines", () => {
  const svg = nodeFaceSvg("fileserver", "owned");
  assert.ok(svg.startsWith("<svg"));
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.ok(svg.includes(NODE_GLYPHS.fileserver.body), "glyph body present");
  assert.ok(svg.includes("clipPath"), "fence clip path present");
  assert.ok(svg.includes("<line"), "fence lines present");
});

test("nodeFaceSvg for an unknown access level draws the glyph but no fence group", () => {
  const svg = nodeFaceSvg("router", "weird");
  assert.ok(svg.includes(NODE_GLYPHS.router.body));
  assert.ok(!svg.includes('clip-path="url(#sf)"'), "no fence group when level unknown");
});

test("nodeFaceDataUri returns an encoded svg data uri (no raw #)", () => {
  const uri = nodeFaceDataUri("mine", "compromised");
  assert.ok(uri.startsWith("data:image/svg+xml,"));
  assert.ok(!uri.slice("data:image/svg+xml,".length).includes("#"), "hex # must be percent-encoded");
});
