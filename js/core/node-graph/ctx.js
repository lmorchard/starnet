// @ts-check
/** @typedef {import('./types.js').CtxInterface} CtxInterface */

/**
 * A no-op context — all methods do nothing. Used as the default when no ctx is provided.
 * @type {CtxInterface}
 */
export const nullCtx = {
  startTrace() {},
  cancelTrace() {},
  giveReward(_amount) {},
  spawnICE(_nodeId) {},
  setGlobalAlert(_level) {},
  enableNode(_nodeId) {},
  disableNode(_nodeId) {},
  revealNode(_nodeId) {},
  log(_message) {},
  startProbe(_nodeId) {},
  cancelProbe() {},
  startExploit(_nodeId, _exploitId) {},
  cancelExploit() {},
  startRead(_nodeId) {},
  cancelRead() {},
  startLoot(_nodeId) {},
  cancelLoot() {},
  ejectIce() {},
  rebootNode(_nodeId) {},
  reconfigureNode(_nodeId) {},
  openDarknetsStore() {},
  resolveProbe(_nodeId) {},
  resolveExploit(_nodeId) {},
  resolveRead(_nodeId) {},
  resolveLoot(_nodeId) {},
  resolveReboot(_nodeId) {},
  startReboot(_nodeId) {},
  completeReboot(_nodeId) {},
  emitActionFeedback(_nodeId, _action, _phase, _progress, _result) {},
};

/**
 * Return a ctx where every method is a call-recording spy.
 * Each method on the returned ctx records calls in `ctx.calls[methodName]`.
 *
 * Compatible with the Node.js built-in test runner (no jest dependency).
 *
 * @returns {CtxInterface & { calls: Record<string, any[][]> }}
 */
export function mockCtx() {
  /** @type {Record<string, any[][]>} */
  const calls = {};

  /** @param {string} name */
  function spy(name) {
    return (...args) => {
      calls[name] = calls[name] ?? [];
      calls[name].push(args);
    };
  }

  const ctx = {
    startTrace: spy("startTrace"),
    cancelTrace: spy("cancelTrace"),
    giveReward: spy("giveReward"),
    spawnICE: spy("spawnICE"),
    setGlobalAlert: spy("setGlobalAlert"),
    enableNode: spy("enableNode"),
    disableNode: spy("disableNode"),
    revealNode: spy("revealNode"),
    log: spy("log"),
    startProbe: spy("startProbe"),
    cancelProbe: spy("cancelProbe"),
    startExploit: spy("startExploit"),
    cancelExploit: spy("cancelExploit"),
    startRead: spy("startRead"),
    cancelRead: spy("cancelRead"),
    startLoot: spy("startLoot"),
    cancelLoot: spy("cancelLoot"),
    ejectIce: spy("ejectIce"),
    rebootNode: spy("rebootNode"),
    reconfigureNode: spy("reconfigureNode"),
    openDarknetsStore: spy("openDarknetsStore"),
    resolveProbe: spy("resolveProbe"),
    resolveExploit: spy("resolveExploit"),
    resolveRead: spy("resolveRead"),
    resolveLoot: spy("resolveLoot"),
    resolveReboot: spy("resolveReboot"),
    startReboot: spy("startReboot"),
    completeReboot: spy("completeReboot"),
    emitActionFeedback: spy("emitActionFeedback"),
    calls,
  };

  return ctx;
}
