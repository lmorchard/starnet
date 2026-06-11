// @ts-check
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./index.js"; // load static commands (registers `exec`)
import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { initGame, getState } from "../state.js";
import { navigateTo } from "../navigation.js";
import { clearAll } from "../timers.js";
import { emitEvent, E } from "../events.js";
import { registry } from "./registry.js";
import { initDynamicActions } from "./dynamic-actions.js";

describe("dynamic-actions namespace separation", () => {
  beforeEach(() => { clearAll(); initGame(() => buildCorporateFoothold()); });

  test("a node with scripts registers no script verbs (only core verbs + static exec)", () => {
    initDynamicActions();
    const s = getState();
    const ids = Object.values(s.nodes).find((n) => n.type === "ids");
    assert.ok(ids);
    s.nodeGraph.setNodeAttr(ids.id, "accessLevel", "owned");
    s.nodeGraph.setNodeAttr(ids.id, "forwardingEnabled", true);
    s.nodes[ids.id].visibility = "accessible";
    navigateTo(ids.id);
    emitEvent(E.STATE_CHANGED, s);
    assert.equal(registry.has("corrupt"), false, "script verb must not be top-level");
    assert.equal(registry.has("exec"), true, "static exec command stays");
  });
});
