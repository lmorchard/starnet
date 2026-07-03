// @ts-check
/** @typedef {import('./types.js').NodeDef} NodeDef */
/** @typedef {import('./types.js').Message} Message */
/** @typedef {import('./types.js').MessageDescriptor} MessageDescriptor */
/** @typedef {import('./types.js').TriggerDef} TriggerDef */
/** @typedef {import('./types.js').ActionDef} ActionDef */
/** @typedef {import('./types.js').CtxInterface} CtxInterface */

import { createMessage, hasCycle } from "./message.js";
import { applyOperators } from "./operators.js";
import { QualityStore } from "./qualities.js";
import { TriggerStore } from "./triggers.js";
import { getAvailableActions, executeAction } from "./actions.js";
import { fillConditionNodeId } from "./conditions.js";
import { applyEffect } from "./effects.js";
import { nullCtx } from "./ctx.js";
import { resolveTraits } from "./traits.js";
import { getTimedActionAttrNames, TIMED_ACTIONS } from "./timed-actions.js";
import { synthesizeTimedActions } from "./timed-synthesis.js";

/**
 * True if a `timed-action` operator's action can be cancelled by ABORT. Hand-wired
 * core verbs look themselves up in the TIMED_ACTIONS registry (reboot is the only
 * `abortable: false` entry there); a synthesized action (declarative ActionDef.timed,
 * not registered in TIMED_ACTIONS) instead carries its own `_abortable` flag on the
 * operator config (set by timed-synthesis.js from `ActionDef.timed.abortable`),
 * defaulting to abortable when unset — matching the pre-#187-Phase-2 behavior for
 * synthesized actions and for any other hand-authored `timed-action` operator that
 * doesn't opt out (e.g. the `volatile` trait).
 * @param {{ action?: string, _abortable?: boolean }} op
 * @returns {boolean}
 */
function isOperatorAbortable(op) {
  const def = TIMED_ACTIONS.find((t) => t.action === op.action);
  if (def) return def.abortable;
  return op._abortable !== false;
}

// Re-exported so callers can reach the timed-action attr-name helper via runtime.
export { getTimedActionAttrNames } from "./timed-actions.js";

/**
 * @typedef {Object} NodeGraphDef
 * @property {NodeDef[]} nodes
 * @property {[string, string][]} edges
 * @property {TriggerDef[]} [triggers]
 */

/**
 * Internal node state stored by the runtime.
 * @typedef {Object} NodeState
 * @property {string} id
 * @property {string} type
 * @property {Record<string, any>} attributes
 * @property {import('./types.js').OperatorConfig[]} operators
 * @property {ActionDef[]} actions
 */

/**
 * The reactive node graph runtime. Headless and self-contained.
 * No DOM, no Cytoscape — just message-passing, operators, triggers, and actions.
 */
export class NodeGraph {
  /**
   * @param {NodeGraphDef} def
   * @param {CtxInterface} [ctx]
   * @param {(eventType: string, payload: object) => void} [onEvent]
   */
  constructor({ nodes, edges, triggers = [] }, ctx = nullCtx, onEvent = () => {}) {
    /** @type {CtxInterface} */
    this._ctx = ctx;

    /** @type {(eventType: string, payload: object) => void} */
    this._onEvent = onEvent;

    /** @type {Map<string, NodeState>} */
    this._nodes = new Map();
    /** @type {TriggerDef[]} */
    const allTriggers = [...triggers];
    for (const raw of nodes) {
      const n = resolveTraits(raw);
      // Declarable `timed` actions (#187, Phase 1) synthesize their timed-action operator
      // + arm effects here, once per constructed node — covers both trait-supplied and
      // inline actions, since both have passed through resolveTraits by this point.
      synthesizeTimedActions(n);
      this._nodes.set(n.id, {
        id: n.id,
        type: n.type,
        attributes: { ...n.attributes },
        operators: n.operators ?? [],
        actions: n.actions ?? [],
      });
      // Collect per-node triggers, pre-filling nodeId in conditions and $nodeId in effects
      if (n.triggers) {
        for (const t of n.triggers) {
          allTriggers.push({
            ...t,
            id: `${n.id}/${t.id}`,
            _nodeId: n.id,
            when: fillConditionNodeId(t.when, n.id),
            then: t.then.map(eff => _fillEffectNodeId(eff, n.id)),
          });
        }
      }
    }

    /** @type {[string, string][]} */
    this._edges = edges;

    this._qualities = new QualityStore();
    this._triggers = new TriggerStore(allTriggers);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Inject a message at a node and propagate it through the graph.
   * @param {string} nodeId
   * @param {Message | MessageDescriptor} message
   */
  sendMessage(nodeId, message) {
    // Normalise MessageDescriptor → Message if needed
    const msg = /** @type {Message} */ (
      "path" in message ? message : createMessage({ type: message.type, origin: nodeId, payload: message.payload ?? {}, destinations: message.destinations })
    );
    // A message may originate at its own target (origin === nodeId — e.g. graph-bridge
    // injecting exploit/alert events). createMessage seeds path:[origin], so the entry
    // delivery's cycle guard would drop it. Strip the target from the entry path; _deliver
    // re-appends it, keeping onward propagation cycle-safe.
    const entry = msg.path.includes(nodeId) ? { ...msg, path: msg.path.filter((p) => p !== nodeId) } : msg;
    this._deliver(nodeId, entry);
    this._evaluateTriggers();
  }

  /**
   * Advance the clock by n ticks. Delivers a tick message to every node n times,
   * then evaluates triggers once after all ticks.
   * @param {number} [n]
   */
  tick(n = 1) {
    for (let i = 0; i < n; i++) {
      const tickMsg = createMessage({ type: "tick", origin: "__system__" });
      for (const nodeId of this._nodes.keys()) {
        this._deliver(nodeId, tickMsg);
      }
    }
    this._evaluateTriggers();
  }

  /**
   * Return a shallow copy of a node's attributes.
   * @param {string} nodeId
   * @returns {Record<string, any>}
   */
  getNodeState(nodeId) {
    const node = this._requireNode(nodeId);
    return { ...node.attributes };
  }

  /** @param {string} name */
  getQuality(name) {
    return this._qualities.get(name);
  }

  /** @param {string} name @param {number} value */
  setQuality(name, value) {
    const previous = this._qualities.get(name);
    this._qualities.set(name, value);
    if (value !== previous) {
      this._onEvent("quality-changed", { name, value, previous });
    }
  }

  /** @param {string} name @param {number} delta */
  deltaQuality(name, delta) {
    const previous = this._qualities.get(name);
    this._qualities.delta(name, delta);
    const current = this._qualities.get(name);
    if (current !== previous) {
      this._onEvent("quality-changed", { name, value: current, previous });
    }
  }

  /**
   * Return actions available on a node (those whose requires pass).
   * @param {string} nodeId
   * @returns {ActionDef[]}
   */
  getAvailableActions(nodeId) {
    const node = this._requireNode(nodeId);
    return getAvailableActions(node.actions, nodeId, this._stateAccessors());
  }

  /**
   * Execute an action on a node. Throws if not found or requires fail.
   * @param {string} nodeId
   * @param {string} actionId
   */
  executeAction(nodeId, actionId) {
    const node = this._requireNode(nodeId);
    executeAction(node.actions, actionId, nodeId, this._actionMutators(nodeId), this._stateAccessors());
    this._evaluateTriggers();
  }

  /**
   * Directly set a node attribute (bypasses operators).
   * Emits a node-state-changed event if the value actually changed.
   * @param {string} nodeId
   * @param {string} attr
   * @param {any} value
   */
  setNodeAttr(nodeId, attr, value) {
    const node = this._requireNode(nodeId);
    const previous = node.attributes[attr];
    node.attributes = { ...node.attributes, [attr]: value };
    if (value !== previous) {
      this._onEvent("node-state-changed", { nodeId, attr, value, previous });
      this._evaluateTriggers();
    }
  }

  /**
   * Attach a behavior (a registered operator config) to a live node at runtime.
   * The operator participates in subsequent deliveries and is serialized by snapshot().
   * Foundation for the RAM loadout (player-equipped behaviors).
   * Callers are responsible for not attaching the same operator twice — a duplicate
   * attach double-propagates (the operator runs once per attached copy per delivery).
   * @param {string} nodeId
   * @param {import('./types.js').OperatorConfig} operatorConfig
   */
  attachBehavior(nodeId, operatorConfig) {
    const node = this._requireNode(nodeId);
    node.operators = [...node.operators, operatorConfig];
  }

  /**
   * Remove every operator with the given name from a live node.
   * @param {string} nodeId
   * @param {string} operatorName
   */
  detachBehavior(nodeId, operatorName) {
    const node = this._requireNode(nodeId);
    node.operators = node.operators.filter((op) => op.name !== operatorName);
  }

  /**
   * Dispatch an init message to every node, then evaluate triggers.
   * Call once after construction, before any tick or action.
   */
  init() {
    const initMsg = createMessage({ type: "init", origin: "__system__" });
    for (const nodeId of this._nodes.keys()) {
      this._deliver(nodeId, initMsg);
    }
    this._evaluateTriggers();
  }

  /**
   * Scan a node's operators for the first active `timed-action`, optionally
   * restricted to abortable ones. Shared by getActiveTimedAction and
   * getActiveAbortableTimedAction.
   * @param {string} nodeId
   * @param {{ abortableOnly?: boolean }} [opts]
   * @returns {{ action: string, activeAttr: string, progressAttr: string, durationAttr: string } | null}
   */
  _findActiveTimedAction(nodeId, { abortableOnly = false } = {}) {
    const node = this._requireNode(nodeId);
    for (const op of node.operators) {
      if (op.name !== "timed-action") continue;
      const activeAttr = op.activeAttr;
      if (!activeAttr || !node.attributes[activeAttr]) continue;
      if (abortableOnly && !isOperatorAbortable(op)) continue;
      const action = op.action ?? "unknown";
      const names = getTimedActionAttrNames(action);
      return {
        action,
        activeAttr,
        progressAttr: op.progressAttr ?? names.progressAttr,
        durationAttr: op.durationAttr ?? names.durationAttr,
      };
    }
    return null;
  }

  /**
   * Find the active timed-action on a node, if any (including a non-abortable one,
   * e.g. reboot). Scans timed-action operators and returns the first whose
   * activeAttr is true.
   * @param {string} nodeId
   * @returns {{ action: string, activeAttr: string, progressAttr: string, durationAttr: string } | null}
   */
  getActiveTimedAction(nodeId) {
    return this._findActiveTimedAction(nodeId);
  }

  /**
   * Find the active timed-action on a node, if any, EXCLUDING one marked
   * non-abortable (e.g. reboot — involuntary, ABORT can't cancel it). Backs the
   * `active-abortable-timed-action` condition that scopes ABORT's visibility
   * (review fix, #187 Phase 2) — distinct from getActiveTimedAction/isNodeBusy,
   * which intentionally still count a non-abortable action as "busy" (a rebooting
   * node still can't start something new).
   * @param {string} nodeId
   * @returns {{ action: string, activeAttr: string, progressAttr: string, durationAttr: string } | null}
   */
  getActiveAbortableTimedAction(nodeId) {
    return this._findActiveTimedAction(nodeId, { abortableOnly: true });
  }

  /**
   * True if the node has an active timed-action that ABORT is allowed to cancel.
   * @param {string} nodeId
   * @returns {boolean}
   */
  hasActiveAbortableTimedAction(nodeId) {
    return this.getActiveAbortableTimedAction(nodeId) != null;
  }

  /**
   * True if the node has any active timed-action operator (#187 Phase 2) — the
   * structural "is this node busy?" check that spans both the hand-wired core
   * verbs and any synthesized `timed` action, without needing to know its
   * (dynamically-named) activeAttr in advance. Does NOT know about the #282
   * process framework (`state.processes`) — that's a separate busy source
   * layered on top at the getAvailableActions level (node-actions.js), since
   * this graph has no access to game state.
   * @param {string} nodeId
   * @returns {boolean}
   */
  isNodeBusy(nodeId) {
    return this.getActiveTimedAction(nodeId) != null;
  }

  /**
   * Return a node's full data: id, type, and all attributes.
   * Useful for populating game state objects.
   * @param {string} nodeId
   * @returns {{ id: string, type: string } & Record<string, any>}
   */
  getNode(nodeId) {
    const node = this._requireNode(nodeId);
    return { id: node.id, type: node.type, ...node.attributes };
  }

  /**
   * Return all node IDs in the graph.
   * @returns {string[]}
   */
  getNodeIds() {
    return [...this._nodes.keys()];
  }

  /**
   * Return the edge list.
   * @returns {[string, string][]}
   */
  getEdges() {
    return this._edges;
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  /**
   * Return a plain JSON-serializable object of the full runtime state.
   * @returns {object}
   */
  snapshot() {
    const nodes = [];
    for (const node of this._nodes.values()) {
      nodes.push({
        id: node.id,
        type: node.type,
        attributes: JSON.parse(JSON.stringify(node.attributes)),
        operators: node.operators,
        actions: node.actions,
      });
    }
    return {
      nodes,
      edges: this._edges,
      triggers: this._triggers.snapshot(),
      qualities: this._qualities.snapshot(),
    };
  }

  /**
   * Construct a NodeGraph from a snapshot.
   * @param {ReturnType<NodeGraph['snapshot']>} snapshot
   * @param {CtxInterface} [ctx]
   * @param {(eventType: string, payload: object) => void} [onEvent]
   * @returns {NodeGraph}
   */
  static fromSnapshot(snapshot, ctx = nullCtx, onEvent = () => {}) {
    const { nodes, edges, triggers, qualities } = /** @type {any} */ (snapshot);
    const graph = new NodeGraph({ nodes, edges, triggers: [] }, ctx, onEvent);
    graph._qualities.restore(qualities);
    graph._triggers.restore(triggers);
    // Restore node attributes from snapshot (overwrite what constructor set)
    for (const n of nodes) {
      const node = graph._nodes.get(n.id);
      if (node) node.attributes = { ...n.attributes };
    }
    return graph;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * @param {string} nodeId
   * @returns {NodeState}
   */
  _requireNode(nodeId) {
    const node = this._nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: "${nodeId}"`);
    return node;
  }

  /**
   * Deliver a message to a node, run its operators, and recursively deliver outgoing messages.
   * Cycle guard: if nodeId already in message path, drop silently.
   * @param {string} nodeId
   * @param {Message} message
   */
  _deliver(nodeId, message) {
    if (hasCycle(message, nodeId)) return;
    const node = this._nodes.get(nodeId);
    if (!node) return;

    const incoming = { ...message, path: [...message.path, nodeId] };

    this._onEvent("message-delivered", { nodeId, message: incoming });

    const oldAttrs = node.attributes;
    const { attributes, outgoing, qualityDeltas, events } = applyOperators(node.operators, node.attributes, incoming, this._ctx);
    node.attributes = attributes;

    // Emit per-attribute change events for operator mutations
    for (const key of Object.keys(attributes)) {
      if (attributes[key] !== oldAttrs[key]) {
        this._onEvent("node-state-changed", { nodeId, attr: key, value: attributes[key], previous: oldAttrs[key] });
      }
    }

    for (const { name, delta } of qualityDeltas) {
      const previous = this._qualities.get(name);
      this._qualities.delta(name, delta);
      const value = this._qualities.get(name);
      if (value !== previous) {
        this._onEvent("quality-changed", { name, value, previous });
      }
    }

    // Emit operator-returned events (e.g. action-feedback from timed-action)
    for (const evt of events) {
      if (evt.type === "operator-effect") {
        // Apply completion effects (ctx-call, set-attr, etc.) through the effect system
        applyEffect(evt.payload, this._actionMutators(nodeId));
      } else {
        this._onEvent(evt.type, evt.payload);
      }
    }

    for (const desc of outgoing) {
      // Resolve destinations: null = all adjacent nodes, array = named nodes
      const targets = desc.destinations ?? this._adjacentNodes(nodeId);
      const outMsg = createMessage({
        type: desc.type,
        origin: message.origin,
        payload: desc.payload ?? {},
        destinations: desc.destinations,
      });
      // Carry the path forward so cycle detection works across hops
      const outMsgWithPath = { ...outMsg, path: [...incoming.path] };
      for (const targetId of targets) {
        this._deliver(targetId, outMsgWithPath);
      }
    }
  }

  /**
   * Return all node ids adjacent to the given node (undirected).
   * @param {string} nodeId
   * @returns {string[]}
   */
  _adjacentNodes(nodeId) {
    const neighbors = [];
    for (const [a, b] of this._edges) {
      if (a === nodeId) neighbors.push(b);
      else if (b === nodeId) neighbors.push(a);
    }
    return neighbors;
  }

  /**
   * Build state accessor object for conditions and trigger evaluation.
   * @returns {{ getNodeAttr: (nodeId: string, attr: string) => any, getQuality: (name: string) => number, isNodeBusy: (nodeId: string) => boolean, hasActiveAbortableTimedAction: (nodeId: string) => boolean }}
   */
  _stateAccessors() {
    return {
      getNodeAttr: (nodeId, attr) => this._nodes.get(nodeId)?.attributes[attr],
      getQuality: (name) => this._qualities.get(name),
      // Guard against an unknown nodeId rather than throwing (matches the other
      // accessors here, which read via optional chaining) — isNodeBusy() itself
      // throws for a missing node, like the rest of the public API (getNodeState, …).
      isNodeBusy: (nodeId) => (this._nodes.has(nodeId) ? this.isNodeBusy(nodeId) : false),
      hasActiveAbortableTimedAction: (nodeId) =>
        this._nodes.has(nodeId) ? this.hasActiveAbortableTimedAction(nodeId) : false,
    };
  }

  /**
   * Emit a message outward from a node, bypassing the source node's own operators.
   * Delivers directly to adjacent nodes (or the message's destinations list).
   * Used by emit-message effects so that action-emitted messages are not
   * re-filtered by the source node's relay/debounce operators.
   * @param {string} sourceNodeId
   * @param {MessageDescriptor} message
   */
  _emitFrom(sourceNodeId, message) {
    const msg = createMessage({
      type: message.type,
      origin: sourceNodeId,
      payload: message.payload ?? {},
      destinations: message.destinations,
    });
    const targets = msg.destinations ?? this._adjacentNodes(sourceNodeId);
    // Mark source as visited so back-propagation is still guarded
    const msgWithPath = { ...msg, path: [sourceNodeId] };
    for (const targetId of targets) {
      this._deliver(targetId, msgWithPath);
    }
  }

  /**
   * Build mutator object for trigger effects.
   * @returns {import('./triggers.js').TriggerMutators}
   */
  _triggerMutators() {
    return {
      setNodeAttr: (nodeId, attr, value) => {
        const node = this._nodes.get(nodeId);
        if (!node) return;
        const previous = node.attributes[attr];
        node.attributes = { ...node.attributes, [attr]: value };
        if (value !== previous) {
          this._onEvent("node-state-changed", { nodeId, attr, value, previous });
        }
      },
      targetNodeId: null,
      getNodeAttr: (nodeId, attr) => this._nodes.get(nodeId)?.attributes[attr],
      getQuality: (name) => this._qualities.get(name),
      setQuality: (name, value) => {
        const previous = this._qualities.get(name);
        this._qualities.set(name, value);
        if (value !== previous) {
          this._onEvent("quality-changed", { name, value, previous });
        }
      },
      deltaQuality: (name, delta) => {
        const previous = this._qualities.get(name);
        this._qualities.delta(name, delta);
        const current = this._qualities.get(name);
        if (current !== previous) {
          this._onEvent("quality-changed", { name, value: current, previous });
        }
      },
      sendMessage: (nodeId, msg) => this.sendMessage(nodeId, msg),
      emitFrom: (nodeId, msg) => this._emitFrom(nodeId, msg),
      ctx: this._ctx,
    };
  }

  /**
   * Build mutator object for action effects (with targetNodeId pre-set).
   * @param {string} nodeId
   * @returns {import('./actions.js').ActionMutators}
   */
  _actionMutators(nodeId) {
    return { ...this._triggerMutators(), targetNodeId: nodeId };
  }

  /** Evaluate all triggers using current state. */
  _evaluateTriggers() {
    this._triggers.evaluate(this._stateAccessors(), this._triggerMutators());
  }
}

// ── Per-node trigger helpers ────────────────────────────────

/**
 * Pre-fill $nodeId in effect args. Replaces "$nodeId" string with the actual nodeId.
 * Also sets targetNodeId for set-attr effects.
 * @param {import('./types.js').Effect} eff
 * @param {string} nodeId
 * @returns {import('./types.js').Effect}
 */
function _fillEffectNodeId(eff, nodeId) {
  if (eff.effect === "ctx-call" && eff.args) {
    return { ...eff, args: eff.args.map(a => a === "$nodeId" ? nodeId : a) };
  }
  return eff;
}
