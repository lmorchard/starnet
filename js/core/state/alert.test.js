// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { NETWORK } from "../../../data/network.js";
import { initState, getState, getVersion } from "./index.js";
import { clearAll } from "../timers.js";
import {
  setGlobalAlert, setTraceCountdown, setTraceTimerId, decrementTraceCountdown,
} from "./alert.js";

describe("state/alert — alert mutations", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
  });

  it("setGlobalAlert changes globalAlert", () => {
    const v = getVersion();
    setGlobalAlert("yellow");
    assert.equal(getState().globalAlert, "yellow");
    assert.equal(getVersion(), v + 1);
  });

  it("setTraceCountdown sets traceSecondsRemaining", () => {
    setTraceCountdown(60);
    assert.equal(getState().traceSecondsRemaining, 60);
  });

  it("setTraceCountdown(null) clears it", () => {
    setTraceCountdown(60);
    setTraceCountdown(null);
    assert.equal(getState().traceSecondsRemaining, null);
  });

  it("setTraceTimerId sets traceTimerId", () => {
    setTraceTimerId(99);
    assert.equal(getState().traceTimerId, 99);
  });

  it("decrementTraceCountdown decrements and returns new value", () => {
    setTraceCountdown(10);
    const result = decrementTraceCountdown();
    assert.equal(result, 9);
    assert.equal(getState().traceSecondsRemaining, 9);
  });

  it("decrementTraceCountdown returns null when not counting", () => {
    const result = decrementTraceCountdown();
    assert.equal(result, null);
  });
});
