// @ts-check
/**
 * JSDoc type definitions for the reactive node graph runtime.
 * No runtime code. To use these types in another file:
 *   import as JSDoc typedef, e.g.
 *   /** typedef {import('./types.js').NodeDef} NodeDef *\/
 */

/**
 * A node definition as supplied to NodeGraph constructor.
 * @typedef {Object} NodeDef
 * @property {string} id
 * @property {string} type
 * @property {Record<string, any>} attributes
 * @property {AtomConfig[]} [atoms]
 * @property {ActionDef[]} [actions]
 */

/**
 * Configuration for a single atom on a node.
 * The `name` field selects the registered atom; remaining fields are atom-specific config.
 * @typedef {Object} AtomConfig
 * @property {string} name
 * @property {string} [filter]        - relay/counter: only process messages of this type
 * @property {string[]} [inputs]      - any-of / all-of: list of origin nodeIds to track
 * @property {number} [period]        - clock / watchdog: emit / timeout every N ticks
 * @property {number} [ticks]         - delay: re-emit after N ticks
 * @property {number} [n]             - counter: emit after N triggers
 * @property {MessageDescriptor} [emits] - counter: message to emit when threshold reached
 * @property {string} [on]            - flag: message type to react to
 * @property {Record<string, any>} [when] - flag: payload key=value pairs that must match
 * @property {string} [attr]          - flag: node attribute name to set
 * @property {any} [value]            - flag: value to assign (default: true)
 */

/**
 * A message envelope passed between nodes.
 * @typedef {Object} Message
 * @property {string} type
 * @property {string} origin          - nodeId of first emitter; preserved through relays
 * @property {string[]} path          - forwarding history; cycle guard + audit trail
 * @property {string[] | null} destinations  - null = broadcast to all connected; array = unicast/multicast
 * @property {Record<string, any>} payload
 */

/**
 * Partial message descriptor used when emitting outgoing messages from atoms.
 * The runtime fills in `origin` and `path` before forwarding.
 * @typedef {Object} MessageDescriptor
 * @property {string} type
 * @property {Record<string, any>} [payload]
 * @property {string[] | null} [destinations]
 */

/**
 * A trigger definition.
 * @typedef {Object} TriggerDef
 * @property {string} id
 * @property {Condition} when
 * @property {Effect[]} then
 * @property {boolean} [fired]
 */

/**
 * A player-invocable action definition.
 * @typedef {Object} ActionDef
 * @property {string} id
 * @property {string} label
 * @property {Condition[]} requires   - implicit all-of; all must pass
 * @property {Effect[]} effects
 */

/**
 * Condition — union of supported condition shapes.
 * @typedef {NodeAttrCondition | QualityGteCondition | QualityEqCondition | AllOfCondition | AnyOfCondition} Condition
 */

/**
 * @typedef {Object} NodeAttrCondition
 * @property {'node-attr'} type
 * @property {string} [nodeId]        - omitted in action requires (runtime fills it in)
 * @property {string} attr
 * @property {any} eq
 */

/**
 * @typedef {Object} QualityGteCondition
 * @property {'quality-gte'} type
 * @property {string} name
 * @property {number} value
 */

/**
 * @typedef {Object} QualityEqCondition
 * @property {'quality-eq'} type
 * @property {string} name
 * @property {number} value
 */

/**
 * @typedef {Object} AllOfCondition
 * @property {'all-of'} type
 * @property {Condition[]} conditions
 */

/**
 * @typedef {Object} AnyOfCondition
 * @property {'any-of'} type
 * @property {Condition[]} conditions
 */

/**
 * Effect — union of supported effect shapes.
 * @typedef {SetAttrEffect | SetNodeAttrEffect | ToggleAttrEffect | EmitMessageEffect |
 *           QualitySetEffect | QualityDeltaEffect | CtxCallEffect | LogEffect |
 *           RevealNodeEffect | EnableNodeEffect} Effect
 */

/**
 * @typedef {Object} SetAttrEffect  - targets the action's own node (self)
 * @property {'set-attr'} effect
 * @property {string} attr
 * @property {any} value
 */

/**
 * @typedef {Object} SetNodeAttrEffect  - targets an explicit nodeId
 * @property {'set-node-attr'} effect
 * @property {string} nodeId
 * @property {string} attr
 * @property {any} value
 */

/**
 * @typedef {Object} ToggleAttrEffect  - flips a boolean attribute on self
 * @property {'toggle-attr'} effect
 * @property {string} attr
 */

/**
 * @typedef {Object} EmitMessageEffect
 * @property {'emit-message'} effect
 * @property {MessageDescriptor} message
 */

/**
 * @typedef {Object} QualitySetEffect
 * @property {'quality-set'} effect
 * @property {string} name
 * @property {number} value
 */

/**
 * @typedef {Object} QualityDeltaEffect
 * @property {'quality-delta'} effect
 * @property {string} name
 * @property {number} delta
 */

/**
 * @typedef {Object} CtxCallEffect
 * @property {'ctx-call'} effect
 * @property {string} method
 * @property {any[]} [args]
 */

/**
 * @typedef {Object} LogEffect
 * @property {'log'} effect
 * @property {string} message
 */

/**
 * @typedef {Object} RevealNodeEffect
 * @property {'reveal-node'} effect
 * @property {string} nodeId
 */

/**
 * @typedef {Object} EnableNodeEffect
 * @property {'enable-node'} effect
 * @property {string} nodeId
 */

/**
 * The game API context interface. The runtime accepts a ctx object; tests inject a
 * mock; the real game wires up actual implementations later.
 * @typedef {Object} CtxInterface
 * @property {() => void} startTrace
 * @property {() => void} cancelTrace
 * @property {(amount: number) => void} giveReward
 * @property {(nodeId: string) => void} spawnICE
 * @property {(level: string) => void} setGlobalAlert
 * @property {(nodeId: string) => void} enableNode
 * @property {(nodeId: string) => void} disableNode
 * @property {(nodeId: string) => void} revealNode
 * @property {(message: string) => void} log
 */

export {};
