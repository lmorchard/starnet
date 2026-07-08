// @ts-check
// TDD: Phase 7a — log-renderer auto-burn log line tests.
// RED phase: written BEFORE implementation, expected to fail until log-renderer.js
// handles PROCESS_STARTED/STEP/ENDED for type:"autoburn" and the XPLOIT outcomes in
// ACTION_RESOLVED with the new outcome field.
//
// Strategy: stub globalThis.document (for renderLogPane's getElementById call),
// import log-renderer.js + initLogRenderer(), drive autoburn events, and capture
// LOG_ENTRY output. This tests the actual production path.
//
// SEED CONVENTION: explicit seed for every initGame().

// Stub DOM before any imports that might touch it
globalThis.document = globalThis.document ?? { getElementById: () => null };

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initGame, getState } from "../js/core/state.js";
import { on, off, clearHandlers, E } from "../js/core/events.js";
import { clearAll, tick } from "../js/core/timers.js";
import { initLogRenderer } from "../js/ui/log-renderer.js";
import { initLog } from "../js/core/log.js";
import { startAutoBurn, initAutoBurn } from "../js/core/autoburn.js";
import { addRoundToHoard, setHoard } from "../js/core/state/player.js";
import { setNodeCoherence } from "../js/core/state/node.js";
import { HEAT_COST } from "../js/core/balance.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";

// Initialize log + renderer once (module-level, idempotent via clearHandlers)
// Each test calls initLogRenderer() after clearHandlers() resets the bus.

afterEach(() => { clearHandlers(); clearAll(); });

function makeRound(rarity = "common", id = "x001") {
  return { id, rarity, types: ["unpatched-ssh"], disclosed: false };
}

/** Capture LOG_ENTRY lines during fn(). */
function captureLog(fn) {
  const lines = [];
  const handler = ({ text }) => lines.push(text);
  on(E.LOG_ENTRY, handler);
  fn();
  off(E.LOG_ENTRY, handler);
  return lines;
}

/** Initialize the game + renderer, capture all log during fn(), then return lines. */
function withRenderer(seed, fn) {
  initGame(() => buildCorporateExchange(), seed);
  initAutoBurn();
  initLogRenderer();  // wires PROCESS_STARTED/STEP, ACTION_RESOLVED, etc.
  const lines = [];
  const handler = ({ text }) => lines.push(text);
  on(E.LOG_ENTRY, handler);
  fn();
  off(E.LOG_ENTRY, handler);
  return lines;
}

// ── Test: PROCESS_STARTED for autoburn ───────────────────────────────────────

describe("log-renderer — autoburn PROCESS_STARTED", () => {
  it("emits an [XPLOIT] Auto-burn start line when type=autoburn", () => {
    const lines = withRenderer("lr-start-1", () => {
      const nodeId = "gateway";
      setHoard([makeRound("common", "s001")]);
      setNodeCoherence(nodeId, 9999);

      startAutoBurn(nodeId, { ceiling: HEAT_COST.xploit * 1 });
      tick(5); // fire one step then stop
    });

    const startLine = lines.find((l) => /auto-burn/i.test(l));
    assert.ok(startLine, `Expected an Auto-burn start line. Got:\n${lines.join("\n")}`);
    assert.match(startLine, /XPLOIT/i, "start line has [XPLOIT] prefix");
    assert.match(startLine, /gateway/, "start line names the node");
    assert.match(startLine, /ceiling/i, "start line mentions ceiling");
  });
});

// ── Test: PROCESS_STEP per-shot lines ────────────────────────────────────────

describe("log-renderer — autoburn PROCESS_STEP chip lines", () => {
  it("emits per-shot chip/coherence lines for type=autoburn", () => {
    const lines = withRenderer("lr-step-1", () => {
      const nodeId = "gateway";
      // 3 rounds, high coherence so it won't crack
      for (let i = 0; i < 3; i++) {
        addRoundToHoard(makeRound("common", `step${i}`));
      }
      setNodeCoherence(nodeId, 9999);

      startAutoBurn(nodeId);
      tick(10); // fire several steps
    });

    const chipLines = lines.filter((l) => /chip.*coherence|coherence.*chip/i.test(l));
    assert.ok(chipLines.length > 0, `Expected chip/coherence lines. Got:\n${lines.join("\n")}`);
    assert.match(chipLines[0], /XPLOIT/i, "chip line has [XPLOIT] prefix");
    assert.match(chipLines[0], /chip/i, "chip line mentions chip");
    assert.match(chipLines[0], /coherence/i, "chip line mentions coherence");
  });
});

// ── Test: ACTION_RESOLVED CRACKED outcome ─────────────────────────────────────

describe("log-renderer — autoburn CRACKED outcome", () => {
  it("emits a CRACKED success line when coherence hits zero", () => {
    const lines = withRenderer("lr-crack-1", () => {
      const nodeId = "gateway";
      for (let i = 0; i < 10; i++) {
        addRoundToHoard(makeRound("rare", `cr${i}`));
      }
      setNodeCoherence(nodeId, 1); // dies on first shot

      startAutoBurn(nodeId);
      tick(50);
    });

    const crackedLine = lines.find((l) => /cracked/i.test(l));
    assert.ok(crackedLine, `Expected a CRACKED outcome line. Got:\n${lines.join("\n")}`);
    assert.match(crackedLine, /XPLOIT/i, "cracked line has [XPLOIT] prefix");
    assert.match(crackedLine, /owned/i, "cracked line mentions 'owned'");
  });
});

// ── Test: ACTION_RESOLVED hoard-dry outcome ───────────────────────────────────

describe("log-renderer — autoburn hoard-dry outcome", () => {
  it("emits a 'barrage stopped — hoard dry' line on hoard-dry", () => {
    const lines = withRenderer("lr-dry-1", () => {
      const nodeId = "gateway";
      setHoard([makeRound("common", "d001")]);
      setNodeCoherence(nodeId, 9999);

      startAutoBurn(nodeId);
      tick(50);
    });

    const stopLine = lines.find((l) => /hoard.dry|hoard dry/i.test(l));
    assert.ok(stopLine, `Expected hoard-dry stop line. Got:\n${lines.join("\n")}`);
  });
});

// ── Test: ACTION_RESOLVED heat-ceiling outcome ────────────────────────────────

describe("log-renderer — autoburn heat-ceiling outcome", () => {
  it("emits a 'barrage stopped — heat ceiling' line on heat-ceiling", () => {
    const lines = withRenderer("lr-ceil-1", () => {
      const nodeId = "gateway";
      for (let i = 0; i < 5; i++) addRoundToHoard(makeRound("common", `c${i}`));
      setNodeCoherence(nodeId, 9999);

      startAutoBurn(nodeId, { ceiling: HEAT_COST.xploit * 2 });
      tick(50);
    });

    const stopLine = lines.find((l) => /heat.ceiling|heat ceiling/i.test(l));
    assert.ok(stopLine, `Expected heat-ceiling stop line. Got:\n${lines.join("\n")}`);
  });
});

// ── Test: no sweep lines for autoburn ────────────────────────────────────────

describe("log-renderer — no sweep lines for autoburn events", () => {
  it("autoburn PROCESS_STARTED does NOT emit a [SWEEP] line", () => {
    const lines = withRenderer("lr-nosweep-1", () => {
      const nodeId = "gateway";
      setHoard([makeRound("common", "ns001")]);
      setNodeCoherence(nodeId, 9999);

      startAutoBurn(nodeId, { ceiling: HEAT_COST.xploit });
      tick(5);
    });

    const sweepLines = lines.filter((l) => /\[SWEEP\]/.test(l));
    assert.equal(sweepLines.length, 0, `Must not emit SWEEP lines for autoburn: ${sweepLines}`);
  });
});
