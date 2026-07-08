// @ts-check
// TDD: Phase 7a — console legibility tests for hoard + coherence status commands.
// RED phase: written BEFORE implementation, expected to fail until cmd-status.js is updated.
//
// Assertions:
//   1. "status summary" includes hoard count, not card/hand language
//   2. "status full" includes hoard breakdown, not card/hand language
//   3. "status hoard" shows hoard grouped by rarity
//   4. "status node <id>" shows coherence for a probed node
//
// SEED CONVENTION: explicit seed passed to every initGame() call.

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initGame, getState } from "../js/core/state.js";
import { addLogEntry } from "../js/core/log.js";
import { on, off, clearHandlers, E } from "../js/core/events.js";
import { clearAll } from "../js/core/timers.js";
import { setHoard } from "../js/core/state/player.js";
import { setNodeCoherence } from "../js/core/state/node.js";
import {
  cmdStatusSummary,
  cmdStatusFull,
  cmdStatusHand,
  cmdStatusNode,
} from "../js/core/console-commands/cmd-status.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";

afterEach(() => { clearHandlers(); clearAll(); });

/** Capture all LOG_ENTRY text emitted synchronously during fn(). */
function captureLog(fn) {
  const lines = [];
  const handler = ({ text }) => lines.push(text);
  on(E.LOG_ENTRY, handler);
  fn();
  off(E.LOG_ENTRY, handler);
  return lines;
}

/** A fixed test hoard: 2 common, 1 uncommon, 1 rare. */
function makeTestHoard() {
  return [
    { id: "a001", rarity: "common",   types: ["unpatched-ssh"], disclosed: false },
    { id: "a002", rarity: "common",   types: ["unpatched-ssh"], disclosed: false },
    { id: "a003", rarity: "uncommon", types: ["weak-auth"],     disclosed: false },
    { id: "a004", rarity: "rare",     types: ["zero-day"],      disclosed: false },
  ];
}

// ── 1. status summary: hoard count, no card/hand language ─────────────────────

describe("cmdStatusSummary — hoard era", () => {
  it("shows hoard round count, not card/hand count", () => {
    initGame(() => buildCorporateExchange(), "st-sum-1");
    setHoard(makeTestHoard());

    const lines = captureLog(() => cmdStatusSummary());
    const text = lines.join("\n");

    // Must mention the hoard count (4 rounds)
    assert.match(text, /hoard/i, "summary includes 'Hoard'");
    assert.match(text, /4/, "summary shows the count (4 rounds)");

    // Must NOT reference 'Hand' or 'cards' in the exploit-count line
    assert.ok(
      !lines.some((l) => /hand:\s*\d+\s*cards/i.test(l)),
      "summary must not show 'Hand: N cards'"
    );
  });
});

// ── 2. status full: hoard breakdown, no HAND section ─────────────────────────

describe("cmdStatusFull — hoard era", () => {
  it("shows hoard breakdown by rarity, no 'HAND' section header", () => {
    initGame(() => buildCorporateExchange(), "st-full-1");
    setHoard(makeTestHoard());

    const lines = captureLog(() => cmdStatusFull());
    const text = lines.join("\n");

    // Must include rarity breakdown
    assert.match(text, /hoard/i, "full status includes 'hoard'");
    assert.match(text, /common/i, "full status mentions common rarity");
    assert.match(text, /uncommon/i, "full status mentions uncommon rarity");
    assert.match(text, /rare/i, "full status mentions rare rarity");

    // Must NOT have the old HAND section header
    assert.ok(
      !lines.some((l) => /^### HAND$/.test(l.trim())),
      "full status must not have a '### HAND' section"
    );

    // Must NOT show individual card lines like "- [1] CardName"
    assert.ok(
      !lines.some((l) => /^-\s*\[\d+\]\s+\w/.test(l)),
      "full status must not show individual numbered card entries"
    );
  });
});

// ── 3. status hoard (formerly "status hand"): rarity summary ─────────────────

describe("cmdStatusHand → hoard — rarity summary", () => {
  it("shows hoard grouped by rarity, with counts", () => {
    initGame(() => buildCorporateExchange(), "st-hoard-1");
    setHoard(makeTestHoard());

    const lines = captureLog(() => cmdStatusHand());
    const text = lines.join("\n");

    assert.match(text, /hoard/i, "'status hoard' header includes HOARD");
    assert.match(text, /common/i, "shows common rarity");
    assert.match(text, /2/, "shows count for common (2)");
    assert.match(text, /uncommon/i, "shows uncommon rarity");
    assert.match(text, /rare/i, "shows rare rarity");

    // Must NOT show individual card lines with index/name/decay
    assert.ok(
      !lines.some((l) => /^-\s*\[\d+\]\s+\w/.test(l)),
      "must not show numbered card lines"
    );
  });

  it("shows empty hoard correctly", () => {
    initGame(() => buildCorporateExchange(), "st-hoard-empty");
    setHoard([]);

    const lines = captureLog(() => cmdStatusHand());
    const text = lines.join("\n");
    assert.match(text, /hoard/i, "empty hoard still mentions 'hoard'");
    assert.match(text, /empty|0 rounds|no rounds/i, "indicates the hoard is empty");
  });
});

// ── 4. status node: shows coherence for a probed node ────────────────────────

describe("cmdStatusNode — coherence readout", () => {
  it("shows coherence/coherenceMax when coherence is set on the targeted node", () => {
    initGame(() => buildCorporateExchange(), "st-node-coh-1");

    // Set coherence on gateway node directly
    const nodeId = "gateway";
    const s = getState();
    // Force-probe the node so it's not obscured
    s.nodes[nodeId].probed = true;
    s.selectedNodeId = nodeId;
    setNodeCoherence(nodeId, 350);
    // Manually set coherenceMax for the display (startAutoBurn sets this via lazy-seed)
    s.nodes[nodeId].coherenceMax = 400;

    const lines = captureLog(() => cmdStatusNode([nodeId]));
    const text = lines.join("\n");

    assert.match(text, /coherence/i, "status node shows coherence");
    assert.match(text, /350/, "shows current coherence value");
  });

  it("omits coherence line when coherence is not set (unstarted node)", () => {
    initGame(() => buildCorporateExchange(), "st-node-nocoh-1");
    const nodeId = "gateway";
    const s = getState();
    s.nodes[nodeId].probed = true;
    s.selectedNodeId = nodeId;
    // Ensure no coherence set
    delete s.nodes[nodeId].coherence;

    const lines = captureLog(() => cmdStatusNode([nodeId]));
    const text = lines.join("\n");

    // Should NOT show a coherence line when coherence is undefined
    assert.ok(
      !lines.some((l) => /coherence/i.test(l)),
      "no coherence line when coherence is not set"
    );
  });
});
