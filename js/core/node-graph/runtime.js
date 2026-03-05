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
import { applyEffect } from "./effects.js";
import { nullCtx } from "./ctx.js";
import { resolveTraits } from "./traits.js";

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
            when: _fillNodeId(t.when, n.id),
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
    this._deliver(nodeId, msg);
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
   * @returns {{ getNodeAttr: (nodeId: string, attr: string) => any, getQuality: (name: string) => number }}
   */
  _stateAccessors() {
    return {
      getNodeAttr: (nodeId, attr) => this._nodes.get(nodeId)?.attributes[attr],
      getQuality: (name) => this._qualities.get(name),
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
 * Pre-fill nodeId in a condition tree. For node-attr conditions without a nodeId,
 * sets it to the owning node's ID. Recurses into all-of/any-of compositions.
 * @param {import('./types.js').Condition} cond
 * @param {string} nodeId
 * @returns {import('./types.js').Condition}
 */
function _fillNodeId(cond, nodeId) {
  if (cond.type === "node-attr" && !cond.nodeId) {
    return { ...cond, nodeId };
  }
  if (cond.type === "all-of" || cond.type === "any-of") {
    return { ...cond, conditions: cond.conditions.map(c => _fillNodeId(c, nodeId)) };
  }
  // quality-from-attr needs nodeId for attr lookup
  if (cond.type === "quality-from-attr" && !cond.nodeId) {
    return { ...cond, nodeId };
  }
  return cond;
}

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
