// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { degradationParams, buildGraphFilterString, HEALTH_THRESHOLD, HEALTH_PEAK_SEVERITY } from "./params.js";

const st = (h, d) => ({ player: { health: { current: h, max: 100 }, deckIntegrity: { current: d, max: 100 } } });

describe("degradationParams severity", () => {
  it("is zero at full health and deck", () => {
    const p = degradationParams(st(100, 100));
    assert.equal(p.health.severity, 0);
    assert.equal(p.deck.severity, 0);
    assert.equal(p.health.overlayOpacity, 0);
  });

  it("is zero at exactly the threshold and below-threshold-only ramps", () => {
    const atThresh = degradationParams(st(HEALTH_THRESHOLD * 100, 100)); // exactly at threshold
    assert.equal(atThresh.health.severity, 0);
    const below = degradationParams(st((HEALTH_THRESHOLD / 2) * 100, 100)); // halfway from threshold to 0
    assert.ok(Math.abs(below.health.severity - HEALTH_PEAK_SEVERITY / 2) < 1e-9); // half the (capped) range
  });

  it("deck reaches 1 at empty; health peaks at the capped intensity, still ramping to empty", () => {
    const p = degradationParams(st(0, 0));
    assert.equal(p.deck.severity, 1);
    // health caps at HEALTH_PEAK_SEVERITY (what ~30% health used to look like), not 1.
    assert.ok(Math.abs(p.health.severity - HEALTH_PEAK_SEVERITY) < 1e-9);
  });

  it("health severity keeps rising all the way to empty (rescaled, not plateaued)", () => {
    const a = degradationParams(st(30, 100)).health.severity;
    const b = degradationParams(st(15, 100)).health.severity;
    const c = degradationParams(st(0, 100)).health.severity;
    assert.ok(a < b && b < c); // continuous ramp across the descent, no flat region
    assert.ok(Math.abs(c - HEALTH_PEAK_SEVERITY) < 1e-9);
  });

  it("increases monotonically as a pool drops", () => {
    const a = degradationParams(st(60, 100)).health.severity;
    const b = degradationParams(st(40, 100)).health.severity;
    const c = degradationParams(st(10, 100)).health.severity;
    assert.ok(a < b && b < c);
  });

  it("pools are independent", () => {
    const p = degradationParams(st(10, 100));
    assert.ok(p.health.severity > 0);
    assert.equal(p.deck.severity, 0);
  });

  it("deck severity rises as deck integrity drops", () => {
    const mild = degradationParams(st(100, 60)).deck;
    const empty = degradationParams(st(100, 0)).deck;
    assert.ok(mild.severity > 0 && mild.severity < empty.severity);
    assert.equal(empty.severity, 1);
  });

  it("deck severity is a convex ramp — gentle early, chaotic only near empty", () => {
    const s100 = degradationParams(st(100, 100)).deck.severity;
    const s75 = degradationParams(st(100, 75)).deck.severity;
    const s50 = degradationParams(st(100, 50)).deck.severity;
    const s15 = degradationParams(st(100, 15)).deck.severity;
    assert.equal(s100, 0);                 // nothing at full
    assert.ok(s75 > 0 && s75 < 0.1);       // barely-there occasional glitches at 75%
    assert.ok(s50 > s75 && s50 < 0.3);     // still modest through mid-range
    assert.ok(s15 > 0.5);                  // chaotic by ~15%
    assert.ok((s50 - s75) < (s15 - s50));  // convex: accelerates toward empty
  });

  it("clamps and tolerates missing/zero-max state", () => {
    assert.equal(degradationParams(st(150, 100)).health.severity, 0); // over max
    assert.equal(degradationParams({}).health.severity, 0);           // missing player
    assert.equal(degradationParams({ player: { health: { current: 5, max: 0 } } }).health.severity, 0); // zero max
  });
});

describe("buildGraphFilterString", () => {
  it("returns bloom only at zero severity", () => {
    assert.equal(buildGraphFilterString(degradationParams(st(100, 100)).health), "url(#starnet-bloom)");
  });
  it("adds blur/hue/contrast when health is degraded", () => {
    const s = buildGraphFilterString(degradationParams(st(10, 100)).health);
    assert.match(s, /^url\(#starnet-bloom\) blur\([\d.]+px\) hue-rotate\([\d.]+deg\) contrast\([\d.]+\)$/);
  });
  it("never references a deck filter (deck damage is a transform + overlay, not a filter)", () => {
    const p = degradationParams(st(10, 10)); // both degraded
    assert.ok(!buildGraphFilterString(p.health).includes("deck-warp"));
  });
});
