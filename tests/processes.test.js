import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initGame, getState, serializeState, deserializeState } from "../js/core/state.js";
import { addProcess, updateProcess } from "../js/core/state/process.js";
import { registerProcess, stepProcesses, abortNodeProcesses, activeProcessOnNode } from "../js/core/processes.js";
import { on, clearHandlers, E } from "../js/core/events.js";
import { clearAll, tick } from "../js/core/timers.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";

afterEach(() => { clearHandlers(); clearAll(); });

// A dummy process: counts up each step, done at 3. Records aborts via a shared sink.
let _aborted = [];
registerProcess("test-counter", {
  step(proc) { updateProcess(proc.id, { n: (proc.n ?? 0) + 1 }); return (getState().processes.find((p) => p.id === proc.id)?.n ?? 0) >= 3; },
  onAbort(proc) { _aborted.push(proc.id); },
});

function addCounter(nodeId = "gateway") {
  const id = 1 + Math.max(0, ...getState().processes.map((p) => p.id));
  addProcess({ id, type: "test-counter", nodeId, n: 0 });
  return id;
}

describe("process framework", () => {
  it("steps active processes on tick and self-removes when done", () => {
    initGame(() => buildCorporateExchange(), "proc-1");
    const ended = [];
    on(E.PROCESS_ENDED, (p) => ended.push(p.reason));
    addCounter();
    assert.ok(activeProcessOnNode(getState(), "gateway"), "process active on its node");
    tick(3); // 3 virtual ticks = 3 steps → done at n=3
    assert.equal(getState().processes.length, 0, "self-removed when done");
    assert.deepEqual(ended, ["complete"], "emitted PROCESS_ENDED{complete}");
    assert.equal(activeProcessOnNode(getState(), "gateway"), false);
  });

  it("abortNodeProcesses removes the node's processes, runs onAbort, emits aborted", () => {
    initGame(() => buildCorporateExchange(), "proc-2");
    _aborted = [];
    const ended = [];
    on(E.PROCESS_ENDED, (p) => ended.push(p.reason));
    const id = addCounter("gateway");
    abortNodeProcesses("gateway");
    assert.equal(getState().processes.length, 0, "removed");
    assert.deepEqual(_aborted, [id], "onAbort ran");
    assert.deepEqual(ended, ["aborted"], "emitted PROCESS_ENDED{aborted}");
  });

  it("processes round-trip through serialize and resume stepping", () => {
    initGame(() => buildCorporateExchange(), "proc-3");
    addCounter();
    const snap = JSON.parse(JSON.stringify(serializeState()));
    deserializeState(snap);
    assert.equal(getState().processes.length, 1, "process round-trips");
    tick(3);
    assert.equal(getState().processes.length, 0, "resumes stepping to completion after load");
  });

  it("removes an orphaned process whose type has no registered handler (no soft-lock)", () => {
    initGame(() => buildCorporateExchange(), "proc-orphan");
    const ended = [];
    on(E.PROCESS_ENDED, (p) => ended.push(p.reason));
    addProcess({ id: 1, type: "unregistered-type", nodeId: "gateway" });
    tick(1);
    assert.equal(getState().processes.length, 0, "orphan removed rather than left stuck");
    assert.deepEqual(ended, ["no-handler"]);
  });

  it("heals a save that predates state.processes", () => {
    initGame(() => buildCorporateExchange(), "proc-4");
    const snap = JSON.parse(JSON.stringify(serializeState()));
    delete snap.processes;
    deserializeState(snap);
    assert.deepEqual(getState().processes, [], "processes heals to []");
  });
});
