// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateNetwork } from "../js/network-gen.js";
import { runBot } from "./bot-player.js";

describe("runBot", () => {
  it("completes F/F mission successfully", () => {
    const net = generateNetwork("bot-test-ff", "F", "F");
    const stats = runBot(net, "bot-test-ff");
    assert.equal(stats.missionSuccess, true, "F/F mission should succeed");
    assert.ok(stats.totalTicks > 0, "should consume ticks");
    assert.ok(stats.nodesOwned > 0, "should own at least some nodes");
    assert.equal(stats.traceFired, false, "trace should not fire at F/F");
  });

  it("runs B/B without crashing", () => {
    const net = generateNetwork("bot-test-bb", "B", "B");
    const stats = runBot(net, "bot-test-bb");
    // May or may not succeed — just verify it completes and returns valid stats
    assert.ok(typeof stats.missionSuccess === "boolean");
    assert.ok(typeof stats.totalTicks === "number");
    assert.ok(stats.totalTicks > 0);
    assert.ok(stats.nodesTotal > 0);
  });

  it("returns all expected stat fields", () => {
    const net = generateNetwork("bot-test-fields", "C", "C");
    const stats = runBot(net, "bot-test-fields");
    const expectedFields = [
      "missionSuccess", "fullClear", "failReason",
      "cardUsesConsumed", "cardsBurned", "storeVisits",
      "cashSpent", "cashRemaining", "totalTicks",
      "peakAlert", "traceFired", "iceDetections",
      "nodesOwned", "nodesTotal",
    ];
    for (const field of expectedFields) {
      assert.ok(field in stats, `missing field: ${field}`);
    }
  });

  it("is deterministic: same seed + difficulty = same stats", () => {
    const net1 = generateNetwork("bot-det", "C", "C");
    const net2 = generateNetwork("bot-det", "C", "C");
    const stats1 = runBot(net1, "bot-det");
    const stats2 = runBot(net2, "bot-det");
    assert.deepStrictEqual(stats1, stats2);
  });

  it("respects tick cap", () => {
    const net = generateNetwork("bot-tick-cap", "S", "S");
    const stats = runBot(net, "bot-tick-cap", { maxTicks: 50 });
    assert.ok(stats.totalTicks <= 50, `expected ≤50 ticks, got ${stats.totalTicks}`);
  });
});
