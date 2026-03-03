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
import { nullCtx } from "./ctx.js";

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
   */
  constructor({ nodes, edges, triggers = [] }, ctx = nullCtx) {
    /** @type {CtxInterface} */
    this._ctx = ctx;

    /** @type {Map<string, NodeState>} */
    this._nodes = new Map();
    for (const n of nodes) {
      this._nodes.set(n.id, {
        id: n.id,
        type: n.type,
        attributes: { ...n.attributes },
        operators: n.operators ?? [],
        actions: n.actions ?? [],
      });
    }

    /** @type {[string, string][]} */
    this._edges = edges;

    this._qualities = new QualityStore();
    this._triggers = new TriggerStore(triggers);
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
    this._qualities.set(name, value);
  }

  /** @param {string} name @param {number} delta */
  deltaQuality(name, delta) {
    this._qualities.delta(name, delta);
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
   * @returns {NodeGraph}
   */
  static fromSnapshot(snapshot, ctx = nullCtx) {
    const { nodes, edges, triggers, qualities } = /** @type {any} */ (snapshot);
    const graph = new NodeGraph({ nodes, edges, triggers: [] }, ctx);
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

    const { attributes, outgoing, qualityDeltas } = applyOperators(node.operators, node.attributes, incoming, this._ctx);
    node.attributes = attributes;

    for (const { name, delta } of qualityDeltas) {
      this._qualities.delta(name, delta);
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
        if (node) node.attributes = { ...node.attributes, [attr]: value };
      },
      targetNodeId: null,
      getNodeAttr: (nodeId, attr) => this._nodes.get(nodeId)?.attributes[attr],
      getQuality: (name) => this._qualities.get(name),
      setQuality: (name, value) => this._qualities.set(name, value),
      deltaQuality: (name, delta) => this._qualities.delta(name, delta),
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
