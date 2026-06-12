// The TIMED_ACTIONS registry (#170) is the single source of truth for the
// timed-action set. These tests assert the traits.js operator configs and the
// attr-name helper stay consistent with it — so adding a timed action to one
// place without the registry fails CI instead of drifting silently.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { TIMED_ACTIONS, ABORTABLE_FLAGS, getTimedActionAttrNames } from "./timed-actions.js";
import { getTrait } from "./traits.js";
import { LIE_LOW_OPERATOR } from "./game-types.js";

// Importing traits.js registers the built-in traits at module load.
const TRAITS_WITH_TIMED_ACTIONS = ["hackable", "lootable", "rebootable"];

/**
 * Every (action, activeAttr) from a timed-action operator the game defines —
 * across the built-in traits plus the standalone LIE_LOW_OPERATOR in game-types.js
 * (lie-low is a WAN action, not a trait). This is the set the registry must mirror.
 */
function definedTimedActions() {
  const found = [];
  for (const name of TRAITS_WITH_TIMED_ACTIONS) {
    const trait = getTrait(name);
    for (const op of trait?.operators ?? []) {
      if (op.name === "timed-action") found.push({ action: op.action, activeAttr: op.activeAttr });
    }
  }
  if (LIE_LOW_OPERATOR?.name === "timed-action") {
    found.push({ action: LIE_LOW_OPERATOR.action, activeAttr: LIE_LOW_OPERATOR.activeAttr });
  }
  return found;
}

describe("TIMED_ACTIONS registry", () => {
  test("getTimedActionAttrNames derives the conventional _ta_<action>_* names", () => {
    assert.deepEqual(getTimedActionAttrNames("xploit"), {
      activeAttr: "exploiting",
      progressAttr: "_ta_xploit_progress",
      durationAttr: "_ta_xploit_duration",
    });
    // Unknown action: still derives the attr names, activeAttr undefined.
    assert.deepEqual(getTimedActionAttrNames("nope"), {
      activeAttr: undefined,
      progressAttr: "_ta_nope_progress",
      durationAttr: "_ta_nope_duration",
    });
  });

  test("ABORTABLE_FLAGS excludes reboot (involuntary, ABORT can't cancel it)", () => {
    assert.ok(!ABORTABLE_FLAGS.includes("rebooting"));
    assert.deepEqual(ABORTABLE_FLAGS, ["probing", "exploiting", "reading", "looting", "mining", "lyingLow"]);
  });

  test("every defined timed-action operator matches a registry entry (action + activeAttr)", () => {
    const byAction = new Map(TIMED_ACTIONS.map((t) => [t.action, t]));
    for (const { action, activeAttr } of definedTimedActions()) {
      const def = byAction.get(action);
      assert.ok(def, `a timed-action operator declares "${action}" missing from TIMED_ACTIONS`);
      assert.equal(def.activeAttr, activeAttr, `activeAttr mismatch for "${action}"`);
    }
  });

  test("every registry action is backed by a defined operator (no phantom entries)", () => {
    const definedActions = new Set(definedTimedActions().map((t) => t.action));
    for (const { action } of TIMED_ACTIONS) {
      assert.ok(definedActions.has(action), `TIMED_ACTIONS lists "${action}" with no operator`);
    }
  });
});
