// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { initGame } from "../state.js";
import { clearAll } from "../timers.js";
import { on, off, E } from "../events.js";
import { cmdStatusSummary, cmdStatusFull } from "./cmd-status.js";

function logs(fn) {
  const captured = [];
  const h = (p) => captured.push(p);
  on(E.LOG_ENTRY, h);
  fn();
  off(E.LOG_ENTRY, h);
  return captured;
}

beforeEach(() => {
  clearAll();
  initGame(() => buildCorporateFoothold(), "status-test");
});

describe("status shows resource pools", () => {
  it("summary includes HEALTH and DECK", () => {
    const out = logs(() => cmdStatusSummary()).map((p) => p.text).join("\n");
    assert.match(out, /HEALTH/);
    assert.match(out, /DECK/);
    assert.match(out, /100/);
  });

  it("full includes health and deck", () => {
    const out = logs(() => cmdStatusFull()).map((p) => p.text).join("\n");
    assert.match(out, /health/i);
    assert.match(out, /deck/i);
  });
});
