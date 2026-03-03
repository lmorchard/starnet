// @ts-check
/** @typedef {import('./types.js').AtomConfig} AtomConfig */
/** @typedef {import('./types.js').Message} Message */
/** @typedef {import('./types.js').MessageDescriptor} MessageDescriptor */
/** @typedef {import('./types.js').CtxInterface} CtxInterface */

/**
 * @typedef {Object} AtomResult
 * @property {Record<string, any>} [attributes]  - partial patch to merge onto node attributes
 * @property {MessageDescriptor[]} [outgoing]    - messages to deliver to connected nodes
 */

/**
 * An atom function: pure reactive function registered by name.
 * @typedef {(config: AtomConfig, nodeAttributes: Record<string, any>, message: Message | null, ctx: CtxInterface) => AtomResult} AtomFn
 */

/** @type {Map<string, AtomFn>} */
const _registry = new Map();

/**
 * Register an atom function by name.
 * @param {string} name
 * @param {AtomFn} fn
 */
export function registerAtom(name, fn) {
  _registry.set(name, fn);
}

/**
 * Return a registered atom function by name; throws if not found.
 * @param {string} name
 * @returns {AtomFn}
 */
export function getAtom(name) {
  const fn = _registry.get(name);
  if (!fn) throw new Error(`Unknown atom: "${name}"`);
  return fn;
}

/**
 * Apply a list of atom configs to a node in order. Each atom's attribute patch is
 * merged into nodeAttributes before calling the next atom (progressive merge).
 * Outgoing messages are collected across all atoms.
 *
 * @param {AtomConfig[]} atomConfigs
 * @param {Record<string, any>} nodeAttributes
 * @param {Message | null} message
 * @param {CtxInterface} ctx
 * @returns {{ attributes: Record<string, any>, outgoing: MessageDescriptor[] }}
 */
export function applyAtoms(atomConfigs, nodeAttributes, message, ctx) {
  let attrs = { ...nodeAttributes };
  /** @type {MessageDescriptor[]} */
  const outgoing = [];

  for (const config of atomConfigs) {
    const fn = getAtom(config.name);
    const result = fn(config, attrs, message, ctx);
    if (result.attributes) {
      attrs = { ...attrs, ...result.attributes };
    }
    if (result.outgoing) {
      outgoing.push(...result.outgoing);
    }
  }

  return { attributes: attrs, outgoing };
}

// ---------------------------------------------------------------------------
// Core atom implementations
// ---------------------------------------------------------------------------

/**
 * relay — forward matching messages to all connected nodes.
 * Supports optional `filter` config (only relay if message.type === filter).
 * Checks forwardingEnabled attribute; drops tick messages silently.
 */
registerAtom("relay", (config, attrs, message, _ctx) => {
  if (!message) return {};
  if (message.type === "tick") return {};
  if (attrs.forwardingEnabled === false) return {};
  if (config.filter && message.type !== config.filter) return {};
  return {
    outgoing: [{ type: message.type, payload: message.payload, destinations: message.destinations }],
  };
});

/**
 * invert — flip signal.active on incoming signal messages before forwarding.
 * Drops non-signal and tick messages silently.
 */
registerAtom("invert", (_config, _attrs, message, _ctx) => {
  if (!message) return {};
  if (message.type === "tick") return {};
  if (message.type !== "signal") return {};
  return {
    outgoing: [{ type: "signal", payload: { ...message.payload, active: !message.payload.active } }],
  };
});

/**
 * any-of — OR gate. config.inputs: [nodeId, ...].
 * Tracks _anyof_state map keyed by origin. Only tracks listed inputs.
 * Emits signal(active:true) when any tracked entry is true.
 */
registerAtom("any-of", (config, attrs, message, _ctx) => {
  if (!message) return {};
  if (message.type !== "signal") return {};
  const inputs = config.inputs ?? [];
  if (!inputs.includes(message.origin)) return {};

  const state = { ...(attrs._anyof_state ?? {}) };
  state[message.origin] = message.payload.active;
  const active = Object.values(state).some(Boolean);
  return {
    attributes: { _anyof_state: state },
    outgoing: [{ type: "signal", payload: { active } }],
  };
});

/**
 * all-of — AND gate. config.inputs: [nodeId, ...].
 * Tracks _allof_state map keyed by origin. Only tracks listed inputs.
 * Emits signal(active:true) only when all entries are true.
 */
registerAtom("all-of", (config, attrs, message, _ctx) => {
  if (!message) return {};
  if (message.type !== "signal") return {};
  const inputs = config.inputs ?? [];
  if (!inputs.includes(message.origin)) return {};

  const state = { ...(attrs._allof_state ?? {}) };
  state[message.origin] = message.payload.active;
  const active = inputs.length > 0 && inputs.every((id) => state[id] === true);
  return {
    attributes: { _allof_state: state },
    outgoing: [{ type: "signal", payload: { active } }],
  };
});

/**
 * latch — set/reset messages toggle persistent `latched` attribute.
 * No outgoing messages.
 */
registerAtom("latch", (_config, _attrs, message, _ctx) => {
  if (!message) return {};
  if (message.type === "set") return { attributes: { latched: true } };
  if (message.type === "reset") return { attributes: { latched: false } };
  return {};
});

/**
 * clock — source atom. config.period (in ticks).
 * Maintains _clock_ticks counter. On tick, increments; when counter reaches period,
 * emits signal(active:true) and resets counter.
 */
registerAtom("clock", (config, attrs, message, _ctx) => {
  if (!message || message.type !== "tick") return {};
  const period = config.period ?? 1;
  const ticks = (attrs._clock_ticks ?? 0) + 1;
  if (ticks >= period) {
    return {
      attributes: { _clock_ticks: 0 },
      outgoing: [{ type: "signal", payload: { active: true } }],
    };
  }
  return { attributes: { _clock_ticks: ticks } };
});

/**
 * delay — buffer incoming messages and re-emit after N ticks.
 * config.ticks: number of ticks to wait.
 * Maintains _delay_queue: [{ type, payload, destinations, remaining }].
 * On tick: decrement all; emit those that reach 0.
 * On other messages: enqueue with remaining = config.ticks.
 */
registerAtom("delay", (config, attrs, message, _ctx) => {
  if (!message) return {};

  const delayTicks = config.ticks ?? 1;
  /** @type {Array<{type: string, payload: Record<string,any>, destinations: string[]|null, remaining: number}>} */
  const queue = (attrs._delay_queue ?? []).map((/** @type {any} */ e) => ({ ...e }));

  if (message.type === "tick") {
    /** @type {MessageDescriptor[]} */
    const outgoing = [];
    const remaining = [];
    for (const entry of queue) {
      entry.remaining -= 1;
      if (entry.remaining <= 0) {
        outgoing.push({ type: entry.type, payload: entry.payload, destinations: entry.destinations });
      } else {
        remaining.push(entry);
      }
    }
    return { attributes: { _delay_queue: remaining }, outgoing };
  }

  // Enqueue the incoming message
  queue.push({
    type: message.type,
    payload: { ...message.payload },
    destinations: message.destinations,
    remaining: delayTicks,
  });
  return { attributes: { _delay_queue: queue } };
});

/**
 * counter — after N triggers, emit a configured message.
 * config.n: threshold; config.emits: MessageDescriptor.
 * config.filter: optional message type to count (if omitted, counts any non-tick message).
 * Maintains _counter_count. Increments on matching messages; resets on emit.
 */
registerAtom("counter", (config, attrs, message, _ctx) => {
  if (!message) return {};
  if (message.type === "tick") return {};
  if (config.filter && message.type !== config.filter) return {};
  const n = config.n ?? 1;
  const count = (attrs._counter_count ?? 0) + 1;
  if (count >= n) {
    return {
      attributes: { _counter_count: 0 },
      outgoing: config.emits ? [config.emits] : [],
    };
  }
  return { attributes: { _counter_count: count } };
});

/**
 * flag — set a named attribute when a matching message arrives.
 * config.on: message type to match (if omitted, matches any non-tick message).
 * config.when: optional { key: value, ... } payload filter — all pairs must match.
 * config.attr: attribute name to set on the node.
 * config.value: value to set (default: true).
 */
registerAtom("flag", (config, attrs, message, _ctx) => {
  if (!message) return {};
  if (message.type === "tick") return {};
  if (config.on && message.type !== config.on) return {};
  if (config.when) {
    for (const [k, v] of Object.entries(config.when)) {
      if (message.payload[k] !== v) return {};
    }
  }
  const value = config.value !== undefined ? config.value : true;
  return { attributes: { [config.attr]: value } };
});

/**
 * watchdog — periodic timeout atom. config.period (in ticks).
 * Any non-tick message resets the internal timer.
 * When period ticks pass without a message, emits a "set" message downstream.
 * Useful for deadman-switch patterns: heartbeat suppresses alarm,
 * silence arms it.
 */
registerAtom("watchdog", (config, attrs, message, _ctx) => {
  if (!message) return {};
  const period = config.period ?? 5;
  if (message.type === "tick") {
    const ticks = (attrs._watchdog_ticks ?? 0) + 1;
    if (ticks >= period) {
      return {
        attributes: { _watchdog_ticks: 0 },
        outgoing: [{ type: "set", payload: {} }],
      };
    }
    return { attributes: { _watchdog_ticks: ticks } };
  }
  // Any non-tick message resets the watchdog timer
  return { attributes: { _watchdog_ticks: 0 } };
});
