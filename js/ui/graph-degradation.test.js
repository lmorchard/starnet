// Teardown regression (#148 review): stopGraphDegradation() must reset the health-driven
// `#cy` filter back to the base bloom, not leave the graph blurred/hue-shifted in whatever
// degraded state it was last set to. The module touches DOM/WebGL, but with a #cy stub and
// no WebGL the filter path runs fine in node (getCy() returns null → deck restore is skipped).

import { test, describe } from "node:test";
import assert from "node:assert/strict";

const cyEl = { style: { filter: "" } };
globalThis.document = {
  getElementById: (id) => (id === "cy" ? cyEl : null),
};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const { updateFromState, stopGraphDegradation } = await import("./graph-degradation.js");

const degraded = { player: { health: { current: 10, max: 100 }, deckIntegrity: { current: 100, max: 100 } } };

describe("graph-degradation teardown", () => {
  test("stopGraphDegradation resets the #cy health filter to base bloom", () => {
    updateFromState(degraded);
    assert.match(cyEl.style.filter, /blur/, "degraded haze should be applied first");

    stopGraphDegradation();
    assert.equal(cyEl.style.filter, "url(#starnet-bloom)", "filter reset to base on teardown");
  });
});
