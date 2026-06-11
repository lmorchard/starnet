// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  VULN_GLYPHS,
  FALLBACK_VULN_GLYPH,
  ALL_VULN_GLYPH_IDS,
  vulnGlyphFor,
  vulnGlyphSvg,
  vulnGlyphDataUri,
} from "./vuln-glyphs.js";
import { VULNERABILITY_TYPES } from "../core/exploits.js";

describe("vuln glyph vocabulary", () => {
  const ids = VULNERABILITY_TYPES.map((v) => v.id);

  test("covers every vulnerability type exactly (no extras, no gaps)", () => {
    assert.equal(Object.keys(VULN_GLYPHS).length, ids.length);
    for (const id of ids) {
      assert.ok(VULN_GLYPHS[id], `missing glyph for ${id}`);
    }
  });

  test("every glyph has a color and a non-empty stroke body", () => {
    for (const id of ids) {
      const g = VULN_GLYPHS[id];
      assert.ok(g.color && /^#[0-9a-fA-F]{3,8}$/.test(g.color), `${id} color`);
      assert.ok(g.body && g.body.length > 0, `${id} body`);
    }
  });

  test("no real vuln type resolves to the fallback glyph", () => {
    for (const id of ids) {
      assert.notEqual(vulnGlyphFor(id), FALLBACK_VULN_GLYPH, `${id} should not be the fallback`);
    }
  });

  test("unknown id falls back", () => {
    assert.equal(vulnGlyphFor("does-not-exist"), FALLBACK_VULN_GLYPH);
  });

  test("ALL_VULN_GLYPH_IDS lists the mapped ids", () => {
    assert.deepEqual(new Set(ALL_VULN_GLYPH_IDS), new Set(ids));
  });

  test("vulnGlyphSvg embeds the type color as stroke", () => {
    const svg = vulnGlyphSvg("unpatched-ssh");
    assert.match(svg, /^<svg[^>]*viewBox="0 0 64 64"/);
    assert.ok(svg.includes(`stroke="${VULN_GLYPHS["unpatched-ssh"].color}"`));
  });

  test("vulnGlyphDataUri is a percent-encoded svg data uri", () => {
    const uri = vulnGlyphDataUri("unpatched-ssh");
    assert.ok(uri.startsWith("data:image/svg+xml,"));
    assert.ok(!uri.includes("#"), "raw # must be percent-encoded");
  });
});
