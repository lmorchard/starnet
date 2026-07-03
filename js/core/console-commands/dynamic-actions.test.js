// @ts-check
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./index.js"; // load static commands (registers `exec`)
import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { initGame, getState } from "../state.js";
import { navigateTo } from "../navigation.js";
import { clearAll } from "../timers.js";
import { emitEvent, on, off, E } from "../events.js";
import { registry } from "./registry.js";
import { initDynamicActions } from "./dynamic-actions.js";

/** Capture events of `type` emitted during fn(). */
function withEvents(type, fn) {
  const captured = [];
  const h = (p) => captured.push(p);
  on(type, h);
  fn();
  off(type, h);
  return captured;
}
const actions = (fn) => withEvents("starnet:action", fn);
const logs = (fn) => withEvents(E.LOG_ENTRY, fn);

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

  test("dynamically-registered core verbs (#284) have no node-completer", () => {
    initDynamicActions();
    const s = getState();
    navigateTo("gateway");
    emitEvent(E.STATE_CHANGED, s);
    const probe = registry.get("probe");
    assert.ok(probe, "expected probe to be dynamically registered for the targeted node");
    assert.ok(!probe.complete, "probe must not offer node completion — it acts on the targeted node");
  });

  test("a dynamic core verb with no args still dispatches on the targeted node (happy path)", () => {
    initDynamicActions();
    const s = getState();
    navigateTo("gateway");
    emitEvent(E.STATE_CHANGED, s);
    const evts = actions(() => registry.get("probe").execute([]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "probe");
    assert.equal(evts[0].nodeId, "gateway");
  });

  test("a dynamic core verb rejects a stray positional arg instead of silently acting on it", () => {
    initDynamicActions();
    const s = getState();
    navigateTo("gateway");
    emitEvent(E.STATE_CHANGED, s);
    let evts;
    const ls = logs(() => { evts = actions(() => registry.get("probe").execute(["gateway"])); });
    assert.ok(ls.some((l) => l.type === "error"), "expected an error log entry");
    assert.equal(evts.length, 0, "must not dispatch when given a stray arg");
  });
});
