// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { trap } from "./trap.js";
import { patrolRoute } from "./patrol-route.js";
import { sentryRadius } from "./sentry-radius.js";
import { relocateOnActivate } from "./relocate-on-activate.js";
import { playerAvoid } from "./player-avoid.js";
import { freeze } from "./freeze.js";

const stubs = [
  { name: "trap", pattern: trap, expectedId: "trap" },
  { name: "patrol-route", pattern: patrolRoute, expectedId: "patrol-route" },
  { name: "sentry-radius", pattern: sentryRadius, expectedId: "sentry-radius" },
  { name: "relocate-on-activate", pattern: relocateOnActivate, expectedId: "relocate-on-activate" },
  { name: "player-avoid", pattern: playerAvoid, expectedId: "player-avoid" },
  { name: "freeze", pattern: freeze, expectedId: "freeze" },
];

describe("pattern: stubs (not-yet-implemented)", () => {
  for (const { name, pattern, expectedId } of stubs) {
    it(`${name}: has stable id`, () => {
      assert.equal(pattern.id, expectedId);
    });
    it(`${name}: onTick() throws "not yet implemented"`, () => {
      assert.throws(() => pattern.onTick({}, {}), /not yet implemented/);
    });
  }
});
