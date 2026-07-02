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
 * @property {boolean} [scatter]        - node is placed independently by the generator
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
 * @property {Record<string, number>} [periodTable] - clock / watchdog: grade → period ticks
 * @property {number} [ticks]         - delay / debounce: re-emit after / suppress for N ticks
 * @property {Record<string, number>} [ticksTable]  - delay / debounce: grade → ticks
 * @property {number} [n]             - counter: emit after N triggers
 * @property {MessageDescriptor} [emits] - counter: message to emit when threshold reached
 * @property {string} [on]            - flag / tally / debounce / report: message type to react to
 * @property {string} [call]          - report: ctx method name to invoke (with the node id)
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
 * @property {boolean} [armable]      - watchdog: stay dormant until the first non-tick message arms it
 * @property {boolean} [_abortable]   - timed-action (synthesized only): whether ABORT/nav-cancel may
 *   cancel this action; set by timed-synthesis.js from ActionDef.timed.abortable, defaults to true
 *   when absent (#187 Phase 2 review fix)
 * @property {ActionFeedbackSpec} [feedback] - timed-action: inline feedback-profile override
 *   (#187 Phase 3), threaded from ActionDef.feedback by timed-synthesis.js and echoed on the
 *   "start" ACTION_FEEDBACK payload — see js/ui/feedback-profiles.js
 * @property {boolean} [emitStartOnArm] - timed-action (synthesized only): set by
 *   timed-synthesis.js for a flat `duration` (no durationTable); makes the operator emit
 *   "start" on the first counting tick instead of the grade-table branch, which flat
 *   durations bypass (#187 review fix — flatstart bug)
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
 * A single follow-up choice step for a multi-step node action. When present, the UI
 * opens a node-anchored choice panel instead of dispatching immediately; picking a
 * choice re-dispatches the action with `{ [payloadKey]: choice.id }`.
 * @typedef {Object} FollowupStep
 * @property {(node: any, state: any) => string} title  - panel heading
 * @property {(node: any, state: any) => Array<{id: string, payloadKey: string, render: string, data: any}>} choices
 * @property {(node: any, state: any) => string} empty  - reason shown when choices is empty (disabled-menu tooltip)
 */

/**
 * A player-invocable action definition.
 * @typedef {Object} ActionDef
 * @property {string} id
 * @property {string} label
 * @property {string} [desc]         - human-readable description for UI tooltips
 * @property {boolean} [noSidebar]   - true if triggered via card click, not sidebar button
 * @property {FollowupStep} [followup]  - if set, choosing this action opens a node-anchored choice panel instead of executing immediately
 * @property {Condition[]} requires   - implicit all-of; all must pass
 * @property {Effect[]} effects
 * @property {TimedActionSpec} [timed]  - if set, synthesizeTimedActions() (timed-synthesis.js) rewrites
 *   this action into a timed one at node construction: a `timed-action` operator (operators.js) is
 *   generated with `onComplete` set to this action's original `effects`, and `effects` itself is
 *   replaced with the "arm" pattern (set active flag, zero progress, seed duration if given). See #187.
 * @property {ActionFeedbackSpec} [feedback]  - per-action feedback profile override (#187 Phase 3):
 *   { overlay?, drone?, completionCue? }. Layered inline → ACTION_FEEDBACK_PROFILES[actionId]
 *   (central) → DEFAULT_PROFILE — see js/ui/feedback-profiles.js `resolveFeedback()`. Threaded onto
 *   the synthesized timed-action operator's config by timed-synthesis.js and emitted on the
 *   ACTION_FEEDBACK "start" payload by operators.js so overlay dispatch + the Strudel audio module
 *   can honor a set-piece author's inline override.
 * @property {boolean} [_timedSynthesized]  - set by synthesizeTimedActions() on the *replacement*
 *   action object it returns; guards against re-synthesizing an already-synthesized node. Never set
 *   on an author-supplied ActionDef directly (see timed-synthesis.js for why).
 */

/**
 * Declares an ActionDef as a timed action (#187, Phase 1). See `timed` on ActionDef.
 * @typedef {Object} TimedActionSpec
 * @property {number} [duration]        - fixed duration in ticks, seeded directly by the arm effects
 * @property {Record<string, number>} [durationTable] - grade → ticks, resolved by the timed-action operator itself
 * @property {boolean} [abortable]      - whether ABORT/nav-cancel can cancel this synthesized action;
 *   defaults to true. Wired onto the synthesized operator as `_abortable` (timed-synthesis.js) and
 *   read by the `active-abortable-timed-action` condition / getActiveAbortableTimedAction (#187 Phase 2 review fix)
 */

/**
 * Per-action feedback profile override (#187 Phase 3) — see `feedback` on ActionDef and
 * js/ui/feedback-profiles.js.
 * @typedef {Object} ActionFeedbackSpec
 * @property {string} [overlay]        - overlay element name (js/ui/overlays/registry.js)
 * @property {string} [drone]          - Strudel drone id (js/audio/strudel/data/drones.js)
 * @property {string} [completionCue]  - Strudel one-shot cue id fired on completion
 */

/**
 * Condition — union of supported condition shapes.
 * @typedef {NodeAttrCondition | QualityGteCondition | QualityEqCondition | QualityFromAttrCondition | NoActiveTimedActionCondition | ActiveAbortableTimedActionCondition | AllOfCondition | AnyOfCondition | NotCondition} Condition
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
 * Passes when the node has NO active timed-action operator (#187 Phase 2) — a
 * structural check (via NodeGraph#isNodeBusy) rather than a named-attribute one,
 * so it also catches a synthesized `timed` action's dynamically-named activeAttr.
 * @typedef {Object} NoActiveTimedActionCondition
 * @property {'no-active-timed-action'} type
 * @property {string} [nodeId]        - omitted in action requires (runtime fills it in)
 */

/**
 * Passes when the node HAS an active timed-action operator that ABORT is allowed
 * to cancel (review fix, #187 Phase 2) — narrower than NoActiveTimedActionCondition:
 * excludes an action registered `abortable: false` (reboot) or a synthesized action
 * whose operator carries `_abortable: false`. Drives ABORT_ACTION.requires.
 * @typedef {Object} ActiveAbortableTimedActionCondition
 * @property {'active-abortable-timed-action'} type
 * @property {string} [nodeId]        - omitted in action requires (runtime fills it in)
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
 * @typedef {Object} NotCondition
 * @property {'not'} type
 * @property {Condition} condition   - passes when the inner condition fails
 */

/**
 * Effect — union of supported effect shapes.
 * @typedef {SetAttrEffect | SetNodeAttrEffect | ToggleAttrEffect | EmitMessageEffect |
 *           QualitySetEffect | QualityDeltaEffect | CtxCallEffect | LogEffect |
 *           LogTemplateEffect | RevealNodeEffect | EnableNodeEffect} Effect
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
 * @typedef {Object} LogTemplateEffect - log with ${quality:name} substitution
 * @property {'log-template'} effect
 * @property {string} template
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
 * @property {(nodeId: string) => void} recordMonitorAlert
 * @property {(nodeId: string) => void} scrubLogs
 * @property {(nodeId: string) => void} lieLow
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
 * @property {(nodeId: string) => void} abortTimedAction
 * @property {() => void} ejectIce
 * @property {(nodeId: string) => void} rebootNode
 * @property {(nodeId: string) => void} reconfigureNode
 * @property {() => void} openDarknetsStore
 * @property {() => void} jackOut
 * @property {(nodeId: string) => void} [resolveProbe]
 * @property {(nodeId: string) => void} [resolveExploit]
 * @property {(nodeId: string) => void} [resolveRead]
 * @property {(nodeId: string) => void} [resolveLoot]
 * @property {(nodeId: string) => void} [resolveMine]
 * @property {(nodeId: string) => void} [resolveReboot]
 * @property {(nodeId: string) => void} [startReboot]
 * @property {(nodeId: string) => void} [completeReboot]
 * @property {(nodeId: string, action: string, phase: string, progress: number, result?: any) => void} [emitActionFeedback]
 * @property {(nodeId: string) => void} [volatileDetonate]
 */

export {};
