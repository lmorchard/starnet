// @ts-check
// Structural guard: a freshly generated network must not alarm ITSELF.
//
// No test asserted this before, which is how a set-piece alarm that fired at
// tick 2 with zero player input survived E1, E2, and every census run: the whole
// suite stayed green while ~55% of generated networks traced themselves 200ms
// into the run. Because runs then ended on a clock the player could not
// influence, every census-derived balance number was measuring the bug.
//
// The guard is deliberately broad — it does not name a piece or an operator. Any
// future set-piece that free-runs an alarm from network init trips it.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { initHeadlessEngine, resetGame, getState, tick } from "../scripts/lib/headless-engine.js";
import { buildGenerated } from "../data/networks/index.js";

const IDLE_TICKS = 300; // 30 virtual seconds — well past every watchdog period
const SEEDS = 12;

/** @param {string} threat */
const specAt = (threat) => ({ threat, wealth: "B", complexity: "C", depth: "C" });

initHeadlessEngine();

/**
 * Generate a network, advance the clock without dispatching a single action, and
 * report the alert state it reached on its own.
 * @param {string} seed
 * @param {{ threat: string }} spec
 */
function idleRun(seed, spec) {
  resetGame(() => buildGenerated({ seed, spec }), seed);
  for (let i = 0; i < IDLE_TICKS; i++) {
    tick();
    if (getState().phase !== "playing") break;
  }
  const s = getState();
  return { alert: s.globalAlert, traceRunning: s.traceSecondsRemaining !== null };
}

describe("generated network at idle", () => {
  // S included deliberately: the grade curve reaches its boundary there (cryptovaults can land
  // at S), so a regression confined to high-threat generation or set-piece placement would slip
  // past an F/C/A-only sweep.
  for (const threat of ["F", "C", "A", "S"]) {
    it(`stays at green with no player input (threat ${threat})`, () => {
      const offenders = [];
      for (let i = 0; i < SEEDS; i++) {
        const seed = `idle-${threat}-${i}`;
        const { alert, traceRunning } = idleRun(seed, specAt(threat));
        if (alert !== "green" || traceRunning) {
          offenders.push(`${seed}: alert=${alert} trace=${traceRunning}`);
        }
      }
      assert.deepEqual(
        offenders,
        [],
        `networks alarmed themselves with no player input:\n  ${offenders.join("\n  ")}`
      );
    });
  }

  it("never starts a trace countdown while idle", () => {
    for (let i = 0; i < SEEDS; i++) {
      const { traceRunning } = idleRun(`idle-trace-${i}`, specAt("C"));
      assert.equal(traceRunning, false, `seed idle-trace-${i} started a trace unprompted`);
    }
  });
});
