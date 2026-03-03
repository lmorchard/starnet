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
    calls,
  };

  return ctx;
}
