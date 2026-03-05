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
 * @property {string[]} [traits]         - trait names resolved at construction time
 * @property {Record<string, any>} attributes
 * @property {OperatorConfig[]} [operators]
 * @property {ActionDef[]} [actions]
 * @property {TriggerDef[]} [triggers]   - per-node triggers (nodeId filled in at construction)
 */

/**
 * Configuration for a single operator on a node.
 * The `name` field selects the registered operator; remaining fields are operator-specific config.
 * @typedef {Object} OperatorConfig
 * @property {string} name
 * @property {string} [filter]        - relay/counter: only process messages of this type
 * @property {string[]} [inputs]      - any-of / all-of: list of origin nodeIds to track
 * @property {string[] | null} [destinations] - relay/debounce: override outgoing destinations (null = broadcast)
 * @property {number} [period]        - clock / watchdog: emit / timeout every N ticks
 * @property {number} [ticks]         - delay / debounce: re-emit after / suppress for N ticks
 * @property {number} [n]             - counter: emit after N triggers
 * @property {MessageDescriptor} [emits] - counter: message to emit when threshold reached
 * @property {string} [on]            - flag / tally / debounce: message type to react to
 * @property {Record<string, any>} [when] - flag: payload key=value pairs that must match
 * @property {string} [attr]          - flag: node attribute name to set
 * @property {any} [value]            - flag: value to assign (default: true)
 * @property {string} [quality]       - tally: quality name to increment
 * @property {number} [delta]         - tally: amount to add per message (default: 1)
 * @property {string} [action]        - timed-action: action name
 * @property {string} [activeAttr]    - timed-action: boolean attribute for "in progress"
 * @property {string} [progressAttr]  - timed-action: numeric progress attribute
 * @property {string} [durationAttr]  - timed-action: numeric duration attribute
 * @property {Record<string, number>} [durationTable] - timed-action: grade → ticks
 * @property {string} [durationAttrSource] - timed-action: read duration from this attribute
 * @property {Effect[]} [onComplete]  - timed-action: effects to fire on completion
 * @property {number} [onProgressInterval] - timed-action: fraction at which to fire progress effects
 * @property {any[]} [onProgressEffects] - timed-action: effects at progress milestones
 * @property {string} [enabledAttr]     - if set, operator is skipped when this node attribute is false
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
 * Partial message descriptor used when emitting outgoing messages from operators.
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
 * @property {boolean} [repeating]    - if true, fires every evaluation cycle the condition is true (not just once)
 * @property {string} [enabledAttr]  - if set, trigger is skipped when owning node's attribute is false
 * @property {string} [_nodeId]      - owning node ID (filled in by runtime for per-node triggers)
 */

/**
 * A player-invocable action definition.
 * @typedef {Object} ActionDef
 * @property {string} id
 * @property {string} label
 * @property {string} [desc]         - human-readable description for UI tooltips
 * @property {boolean} [noSidebar]   - true if triggered via card click, not sidebar button
 * @property {Condition[]} requires   - implicit all-of; all must pass
 * @property {Effect[]} effects
 */

/**
 * Condition — union of supported condition shapes.
 * @typedef {NodeAttrCondition | QualityGteCondition | QualityEqCondition | QualityFromAttrCondition | AllOfCondition | AnyOfCondition} Condition
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
 * @typedef {Object} QualityFromAttrCondition
 * @property {'quality-from-attr'} type
 * @property {string} [nodeId]       - omitted in per-node triggers (runtime fills it in)
 * @property {string} attr           - node attribute containing the quality name
 * @property {number} [gte]          - quality value >= threshold
 * @property {number} [eq]           - quality value === threshold
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
 *
 * Includes both set-piece-level callbacks (startTrace, giveReward, etc.) and
 * game action callbacks (startProbe, startExploit, etc.) so that NodeDef actions
 * can invoke any game function via ctx-call effects.
 *
 * @typedef {Object} CtxInterface
 * @property {() => void} startTrace
 * @property {() => void} cancelTrace
 * @property {(amount: number) => void} giveReward
 * @property {(nodeId: string) => void} spawnICE
 * @property {() => void} [stopIce]
 * @property {() => void} [disableIce]
 * @property {(level: string) => void} setGlobalAlert
 * @property {(nodeId: string) => void} enableNode
 * @property {(nodeId: string) => void} disableNode
 * @property {(nodeId: string) => void} revealNode
 * @property {(message: string) => void} log
 * @property {(nodeId: string) => void} startProbe
 * @property {() => void} cancelProbe
 * @property {(nodeId: string, exploitId?: string) => void} startExploit
 * @property {() => void} cancelExploit
 * @property {(nodeId: string) => void} startRead
 * @property {() => void} cancelRead
 * @property {(nodeId: string) => void} startLoot
 * @property {() => void} cancelLoot
 * @property {() => void} ejectIce
 * @property {(nodeId: string) => void} rebootNode
 * @property {(nodeId: string) => void} reconfigureNode
 * @property {() => void} openDarknetsStore
 * @property {(nodeId: string) => void} [resolveProbe]
 * @property {(nodeId: string) => void} [resolveExploit]
 * @property {(nodeId: string) => void} [resolveRead]
 * @property {(nodeId: string) => void} [resolveLoot]
 * @property {(nodeId: string) => void} [resolveReboot]
 * @property {(nodeId: string) => void} [startReboot]
 * @property {(nodeId: string) => void} [completeReboot]
 * @property {(nodeId: string, action: string, phase: string, progress: number, result?: any) => void} [emitActionFeedback]
 * @property {(nodeId: string) => void} [volatileDetonate]
 */

export {};
