import {
  defineComponent,
  defineQuery,
  defineSystem,
  Types,
  addComponent,
  removeComponent,
  exitQuery,
  enterQuery,
  addEntity,
  hasComponent,
} from "bitecs";
import { GraphLayoutScene, GraphLayoutNode } from "./graphLayout";
import { Position } from "./positionMotion.js";
import { Renderable, RenderableShape } from "./viewport/index.js";
import { genid } from "./randoms";

export function init(world) {
  world.networks = {};
  world.nodeIdToEntityId = {};
}

export const NetworkState = defineComponent({
  networkId: Types.ui32,
  graphLayoutSceneEid: Types.eid,
  active: Types.i8,
});

export const networkStateQuery = defineQuery([NetworkState]);

export const NetworkNodeState = defineComponent({
  networkEid: Types.eid,
  networkId: Types.ui32,
  nodeId: Types.ui32,
  visible: Types.i8,
});

export const networkNodeStateQuery = defineQuery([NetworkNodeState]);
export const enterNetworkNodeStateQuery = enterQuery(networkNodeStateQuery);
export const exitNetworkNodeStateQuery = exitQuery(networkNodeStateQuery);

export function spawnEntitiesForNetwork(world, network) {
  world.networks[network.id] = network;

  const networkEid = addEntity(world);
  addComponent(world, NetworkState, networkEid);
  NetworkState.networkId[networkEid] = network.id;
  NetworkState.graphLayoutSceneEid[networkEid] = null;
  NetworkState.active[networkEid] = false;

  for (const nodeId in network.children) {
    const node = network.children[nodeId];
    const nodeEid = addEntity(world);

    addComponent(world, NetworkNodeState, nodeEid);
    NetworkNodeState.networkEid[nodeEid] = networkEid;
    NetworkNodeState.networkId[nodeEid] = node.network.id;
    NetworkNodeState.nodeId[nodeEid] = node.id;
    NetworkNodeState.visible[nodeEid] = false;
    world.nodeIdToEntityId[node.id] = nodeEid;
  }

  return networkEid;
}

export const networkGraphLayoutSystem = defineSystem((world) => {
  // 0. Update node ID to EID indexes
  for (const eid of enterNetworkNodeStateQuery(world)) {
    const nodeId = NetworkNodeState.nodeId[eid];
    world.nodeIdToEntityId[nodeId] = eid;
  }
  const entries = Object.entries(world.nodeIdToEntityId);
  for (const deletedEid of exitNetworkNodeStateQuery(world)) {
    entries.forEach(([id, eid]) => {
      if (eid === deletedEid) {
        delete world.nodeIdToEntityId[id];
      }
    });
  }

  // 1. Ensure scenes exist only for active networks
  for (const networkEid of networkStateQuery(world)) {
    if (NetworkState.active[networkEid]) {
      if (!hasComponent(world, GraphLayoutScene, networkEid)) {
        addComponent(world, GraphLayoutScene, networkEid);
        GraphLayoutScene.active[networkEid] = true;
        GraphLayoutScene.ratio[networkEid] = 100;
      }
    } else {
      if (hasComponent(world, GraphLayoutScene, networkEid)) {
        removeComponent(world, GraphLayoutScene, networkEid);
      }
    }
  }

  // 2. Ensure graph nodes exist for visible nodes of active networks
  for (const nodeEid of networkNodeStateQuery(world)) {
    const nodeVisible = NetworkNodeState.visible[nodeEid];
    const nodeId = NetworkNodeState.nodeId[nodeEid];
    const networkEid = NetworkNodeState.networkEid[nodeEid];
    const networkActive = NetworkState.active[networkEid];
    const networkId = NetworkState.networkId[networkEid];
    const network = world.networks[networkId];
    const node = network.children[nodeId];

    if (networkActive && nodeVisible) {
      if (!hasComponent(world, GraphLayoutNode, nodeEid)) {
        addComponent(world, GraphLayoutNode, nodeEid);
        addComponent(world, Renderable, nodeEid);
        addComponent(world, Position, nodeEid);

        GraphLayoutNode.sceneId[nodeEid] = networkEid;
        GraphLayoutNode.nodeId[nodeEid] = nodeId;
        Renderable.shape[nodeEid] =
          RenderableShape[node.type] || RenderableShape.Node;
        Position.x[nodeEid] = 0;
        Position.y[nodeEid] = 0;
      }
    } else {
      if (hasComponent(world, GraphLayoutNode, nodeEid)) {
        removeComponent(world, GraphLayoutNode, nodeEid);
        removeComponent(world, Renderable, nodeEid);
        removeComponent(world, Position, nodeEid);
      }
    }
  }

  // 3. Update connections for all visible graph nodes
  for (const fromNodeEid of networkNodeStateQuery(world)) {
    if (hasComponent(world, GraphLayoutNode, fromNodeEid)) {
      const fromNodeId = NetworkNodeState.nodeId[fromNodeEid];
      const networkEid = NetworkNodeState.networkEid[fromNodeEid];
      const networkId = NetworkState.networkId[networkEid];
      const network = world.networks[networkId];
      const fromNode = network.children[fromNodeId];

      const connections = GraphLayoutNode.connections[fromNodeEid];
      connections.fill(0);
      let connectionsIdx = 0;
      for (const toNodeId in fromNode.connections) {
        const toNodeEid = world.nodeIdToEntityId[toNodeId];
        if (hasComponent(world, GraphLayoutNode, toNodeEid)) {
          connections[connectionsIdx++] = toNodeEid;
        }
      }
    }
  }
});

export class Base {
  defaults() {
    return {};
  }

  constructor(optionsIn = {}) {
    const options = {
      ...this.defaults(),
      ...optionsIn,
    };
    const { id = genid(), type = this.constructor.name } = options;
    Object.assign(this, { ...options, id, type });
  }
}

export class Network extends Base {
  children = {};

  add(...nodes) {
    for (const node of nodes) {
      this.children[node.id] = node;
      node.network = this;
    }
    return nodes;
  }

  remove(...nodes) {
    for (const node of nodes) {
      node.network = null;
      delete this.children[node.id];
    }
  }
}

export class NetworkNode extends Base {
  connections = {};

  setNetwork(network) {
    this.network = network;
  }

  connect(...others) {
    for (const other of others) {
      this.connectTo(other);
      other.connectTo(this);
    }
  }

  connectTo(other) {
    this.connections[other.id] = other;
  }
}

export class GatewayNode extends NetworkNode {}
export class StorageNode extends NetworkNode {}
export class FirewallNode extends NetworkNode {}
export class HubNode extends NetworkNode {}
export class TerminalNode extends NetworkNode {}
export class WalletNode extends NetworkNode {}
export class ICENode extends NetworkNode {}
