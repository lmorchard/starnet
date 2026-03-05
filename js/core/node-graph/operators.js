// @ts-check
/** @typedef {import('./types.js').OperatorConfig} OperatorConfig */
/** @typedef {import('./types.js').Message} Message */
/** @typedef {import('./types.js').MessageDescriptor} MessageDescriptor */
/** @typedef {import('./types.js').CtxInterface} CtxInterface */

/**
 * @typedef {Object} OperatorResult
 * @property {Record<string, any>} [attributes]  - partial patch to merge onto node attributes
 * @property {MessageDescriptor[]} [outgoing]    - messages to deliver to connected nodes
 * @property {{name: string, delta: number}[]} [qualityDeltas] - quality increments to apply
 * @property {{type: string, payload: object}[]} [events] - game events to emit via onEvent
 */

/**
 * An operator function: pure reactive function registered by name.
 * @typedef {(config: OperatorConfig, nodeAttributes: Record<string, any>, message: Message | null, ctx: CtxInterface) => OperatorResult} OperatorFn
 */

/** @type {Map<string, OperatorFn>} */
const _registry = new Map();

/**
 * Register an operator function by name.
 * @param {string} name
 * @param {OperatorFn} fn
 */
export function registerOperator(name, fn) {
  _registry.set(name, fn);
}

/**
 * Return a registered operator function by name; throws if not found.
 * @param {string} name
 * @returns {OperatorFn}
 */
export function getOperator(name) {
  const fn = _registry.get(name);
  if (!fn) throw new Error(`Unknown operator: "${name}"`);
  return fn;
}

/**
 * Apply a list of operator configs to a node in order. Each operator's attribute patch is
 * merged into nodeAttributes before calling the next operator (progressive merge).
 * Outgoing messages are collected across all operators.
 *
 * @param {OperatorConfig[]} operatorConfigs
 * @param {Record<string, any>} nodeAttributes
 * @param {Message | null} message
 * @param {CtxInterface} ctx
 * @returns {{ attributes: Record<string, any>, outgoing: MessageDescriptor[], qualityDeltas: {name: string, delta: number}[], events: {type: string, payload: object}[] }}
 */
export function applyOperators(operatorConfigs, nodeAttributes, message, ctx) {
  let attrs = { ...nodeAttributes };
  /** @type {MessageDescriptor[]} */
  const outgoing = [];
  /** @type {{name: string, delta: number}[]} */
  const qualityDeltas = [];
  /** @type {{type: string, payload: object}[]} */
  const events = [];

  for (const config of operatorConfigs) {
    if (config.enabledAttr && attrs[config.enabledAttr] === false) continue;
    const fn = getOperator(config.name);
    const result = fn(config, attrs, message, ctx);
    if (result.attributes) {
      attrs = { ...attrs, ...result.attributes };
    }
    if (result.outgoing) {
      outgoing.push(...result.outgoing);
    }
    if (result.qualityDeltas) {
      qualityDeltas.push(...result.qualityDeltas);
    }
    if (result.events) {
      events.push(...result.events);
    }
  }

  return { attributes: attrs, outgoing, qualityDeltas, events };
}

// ---------------------------------------------------------------------------
// Core operator implementations
// ---------------------------------------------------------------------------

/**
 * relay — forward matching messages to all connected nodes.
 * Supports optional `filter` config (only relay if message.type === filter).
 * Checks forwardingEnabled attribute; drops tick messages silently.
 */
registerOperator("relay", (config, attrs, message, _ctx) => {
  if (!message) return {};
  if (message.type === "tick") return {};
  if (attrs.forwardingEnabled === false) return {};
  if (config.filter && message.type !== config.filter) return {};
  const destinations = "destinations" in config ? config.destinations : message.destinations;
  return {
    outgoing: [{ type: message.type, payload: message.payload, destinations }],
  };
});

/**
 * invert — flip signal.active on incoming signal messages before forwarding.
 * Drops non-signal and tick messages silently.
 */
registerOperator("invert", (_config, _attrs, message, _ctx) => {
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
registerOperator("any-of", (config, attrs, message, _ctx) => {
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
registerOperator("all-of", (config, attrs, message, _ctx) => {
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
registerOperator("latch", (_config, _attrs, message, _ctx) => {
  if (!message) return {};
  if (message.type === "set") return { attributes: { latched: true } };
  if (message.type === "reset") return { attributes: { latched: false } };
  return {};
});

/**
 * clock — source operator. config.period (in ticks).
 * Maintains _clock_ticks counter. On tick, increments; when counter reaches period,
 * emits signal(active:true) and resets counter.
 */
registerOperator("clock", (config, attrs, message, _ctx) => {
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
registerOperator("delay", (config, attrs, message, _ctx) => {
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
registerOperator("counter", (config, attrs, message, _ctx) => {
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
registerOperator("flag", (config, _attrs, message, _ctx) => {
  if (!message) return {};
  if (message.type === "tick") return {};
  if (config.on && message.type !== config.on) return {};
  if (config.when) {
    for (const [k, v] of Object.entries(config.when)) {
      if (message.payload[k] !== v) return {};
    }
  }
  if (!config.attr) return {};
  const value = config.value !== undefined ? config.value : true;
  return { attributes: { [config.attr]: value } };
});

/**
 * watchdog — periodic timeout operator. config.period (in ticks).
 * Any non-tick message resets the internal timer.
 * When period ticks pass without a message, emits a "set" message downstream.
 * Useful for deadman-switch patterns: heartbeat suppresses alarm,
 * silence arms it.
 */
registerOperator("watchdog", (config, attrs, message, _ctx) => {
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

/**
 * tally — increment a named quality on each matching message.
 * config.on: optional message type filter (if omitted, counts any non-tick message).
 * config.quality: quality name to increment.
 * config.delta: amount to add per message (default: 1).
 *
 * Quality deltas are returned as `qualityDeltas` in the OperatorResult and applied
 * by the runtime (not stored in node attributes). This keeps the operator pure.
 */
registerOperator("tally", (config, _attrs, message, _ctx) => {
  if (!message) return {};
  if (message.type === "tick") return {};
  if (config.on && message.type !== config.on) return {};
  const delta = config.delta ?? 1;
  return { qualityDeltas: [{ name: config.quality ?? "", delta }] };
});

/**
 * debounce — forward first matching message, then suppress for N ticks.
 * config.on: optional message type filter (if omitted, reacts to any non-tick message).
 * config.ticks: cooldown period in ticks (default: 1).
 * config.destinations: optional override for outgoing destinations.
 *
 * Useful for rate-limiting: honeypots, noisy sensors, burst attack patterns.
 */
/**
 * timed-action — generic lifecycle operator for timed game actions.
 *
 * Watches for `activeAttr` transitioning to true (action started), then on each
 * tick increments progress, emits action-feedback events, and fires onComplete
 * effects when progress reaches duration.
 *
 * Config:
 *   action: string       — action name (e.g. "probe", "exploit")
 *   activeAttr: string   — boolean attribute for "in progress" (e.g. "probing")
 *   progressAttr?: string — numeric attribute for elapsed ticks (default: "_ta_{action}_progress")
 *   durationAttr?: string — numeric attribute for total ticks (default: "_ta_{action}_duration")
 *   durationTable?: Record<string, number> — grade → ticks lookup
 *   onComplete?: Effect[] — effects to fire on completion (stored as data, executed by ctx)
 *   onProgressInterval?: number — fraction (0-1) at which to fire onProgressEffects
 *   onProgressEffects?: Effect[] — effects to fire at progress milestones (e.g. exploit noise)
 */
registerOperator("timed-action", (config, attrs, message, _ctx) => {
  if (!message || message.type !== "tick") return {};

  const action = config.action ?? "unknown";
  const activeAttr = config.activeAttr;
  if (!activeAttr) return {};

  const progressAttr = config.progressAttr ?? `_ta_${action}_progress`;
  const durationAttr = config.durationAttr ?? `_ta_${action}_duration`;

  const isActive = attrs[activeAttr];
  const progress = attrs[progressAttr] ?? 0;
  const duration = attrs[durationAttr] ?? 0;

  if (!isActive) return {};

  // First tick after activation: set duration from grade table or durationAttrSource
  if (progress === 0 && duration === 0 && (config.durationTable || config.durationAttrSource)) {
    let gradeDuration;
    if (config.durationAttrSource) {
      // Read duration from a named attribute (e.g. volatileDelay)
      gradeDuration = attrs[config.durationAttrSource] ?? 30;
    } else {
      const grade = attrs.grade ?? "D";
      gradeDuration = config.durationTable[grade] ?? config.durationTable["D"] ?? 20;
    }
    // Apply durationMultiplier if present (e.g. hardened trait)
    const multiplier = attrs.durationMultiplier ?? 1;
    gradeDuration = Math.ceil(gradeDuration * multiplier);
    return {
      attributes: {
        [durationAttr]: gradeDuration,
      },
      events: [{
        type: "action-feedback",
        payload: { nodeId: attrs.label, action, phase: "start", progress: 0, durationTicks: gradeDuration },
      }],
    };
  }

  // Duration not yet set (waiting for ctx to set it, e.g. exploit)
  if (duration === 0) return {};

  const newProgress = progress + 1;

  // Check progress milestone effects (e.g. exploit noise every 10%)
  // Falls back to node-level noiseInterval/noiseEffects attributes (e.g. audited trait)
  /** @type {MessageDescriptor[]} */
  const outgoing = [];
  const interval = config.onProgressInterval ?? attrs.noiseInterval ?? null;
  const noiseEffects = config.onProgressEffects ?? attrs.noiseEffects ?? null;
  if (interval && duration > 0) {
    const prevFrac = progress / duration;
    const newFrac = newProgress / duration;
    const prevStep = Math.floor(prevFrac / interval);
    const newStep = Math.floor(newFrac / interval);
    if (newStep > prevStep) {
      if (noiseEffects) {
        for (const eff of noiseEffects) {
          if (eff.effect === "emit-message") {
            outgoing.push(eff.message ?? { type: eff.type ?? "noise", payload: eff.payload ?? {} });
          }
        }
      } else {
        // Default noise: emit exploit-noise message (ICE detection compatible)
        outgoing.push({ type: "exploit-noise", payload: {} });
      }
    }
  }

  if (newProgress >= duration) {
    // Completed — fire onComplete effects via ctx-call events
    /** @type {{type: string, payload: object}[]} */
    const events = [{
      type: "action-feedback",
      payload: { nodeId: attrs.label, action, phase: "complete", progress: 1.0 },
    }];

    // Fire onComplete as ctx-call events (runtime will apply them)
    const completionCalls = (config.onComplete ?? []).map((/** @type {any} */ eff) => ({
      type: "operator-effect",
      payload: eff,
    }));
    events.push(...completionCalls);

    return {
      attributes: {
        [activeAttr]: false,
        [progressAttr]: 0,
        [durationAttr]: 0,
      },
      outgoing,
      events,
    };
  }

  // In progress
  return {
    attributes: { [progressAttr]: newProgress },
    outgoing,
    events: [{
      type: "action-feedback",
      payload: { nodeId: attrs.label, action, phase: "progress", progress: newProgress / duration },
    }],
  };
});

registerOperator("debounce", (config, attrs, message, _ctx) => {
  if (!message) return {};
  const ticks = config.ticks ?? 1;

  if (message.type === "tick") {
    const cooldown = attrs._debounce_cooldown ?? 0;
    if (cooldown > 0) return { attributes: { _debounce_cooldown: cooldown - 1 } };
    return {};
  }

  if (config.on && message.type !== config.on) return {};

  const cooldown = attrs._debounce_cooldown ?? 0;
  if (cooldown > 0) return {}; // Suppressed during cooldown

  const destinations = "destinations" in config ? config.destinations : message.destinations;
  return {
    attributes: { _debounce_cooldown: ticks },
    outgoing: [{ type: message.type, payload: message.payload, destinations }],
  };
});
