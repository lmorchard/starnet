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
  removeEntity,
  hasComponent,
} from "bitecs";
import {
  GraphLayoutScene,
  GraphLayoutEdge,
  GraphLayoutNode,
} from "./graphLayout";
import { Position } from "./positionMotion.js";
import { Renderable, RenderableShape } from "./viewport/index.js";
import { genid } from "./randoms";

export function init(world) {
  world.networks = {};
  world.networkIdToEntityId = {};
  world.nodeIdToEntityId = {};
}

export const NetworkState = defineComponent({
  networkId: Types.i32,
  graphLayoutSceneEid: Types.eid,
  active: Types.i8,
});

export const networkStateQuery = defineQuery([NetworkState]);
export const enterNetworkStateQuery = enterQuery(networkStateQuery);
export const exitNetworkStateQuery = exitQuery(networkStateQuery);

export const NetworkNodeState = defineComponent({
  networkEid: Types.eid,
  networkId: Types.i32,
  nodeId: Types.i32,
  visible: Types.i8,
});

export const networkNodeStateQuery = defineQuery([NetworkNodeState]);
export const enterNetworkNodeStateQuery = enterQuery(networkNodeStateQuery);
export const exitNetworkNodeStateQuery = exitQuery(networkNodeStateQuery);

export const networkToEntityIndexerSystem = defineSystem((world) => {
  const indexes = [
    [
      NetworkState,
      world.networkIdToEntityId,
      "networkId",
      enterNetworkStateQuery,
      exitNetworkStateQuery,
    ],
    [
      NetworkNodeState,
      world.nodeIdToEntityId,
      "nodeId",
      enterNetworkNodeStateQuery,
      exitNetworkNodeStateQuery,
    ],
  ];
  for (const [Component, index, propName, enterQuery, exitQuery] of indexes) {
    for (const eid of enterQuery(world)) {
      const nodeId = Component[propName][eid];
      index[nodeId] = eid;
    }
    const entries = Object.entries(index);
    for (const deletedEid of exitQuery(world)) {
      entries.forEach(([id, eid]) => {
        if (eid === deletedEid) {
          delete index[id];
        }
      });
    }
  }
});

export function spawnEntitiesForNetwork(world, network) {
  world.networks[network.id] = network;

  const networkEid = addEntity(world);
  addComponent(world, NetworkState, networkEid);
  NetworkState.networkId[networkEid] = network.id;
  NetworkState.graphLayoutSceneEid[networkEid] = null;
  NetworkState.active[networkEid] = false;
  world.networkIdToEntityId[network.id] = networkEid;

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
  for (const networkEid of networkStateQuery(world)) {
    const networkId = NetworkState.networkId[networkEid];
    if (NetworkState.active[networkEid]) {
      if (!hasComponent(world, GraphLayoutScene, networkEid)) {
        addComponent(world, GraphLayoutScene, networkEid);
        GraphLayoutScene.active[networkEid] = true;
        GraphLayoutScene.sceneId[networkEid] = networkEid;
        GraphLayoutScene.ratio[networkEid] = 100;
        console.log("SPAWNED LAYOUT FOR", networkId);
      }
    } else {
      if (hasComponent(world, GraphLayoutScene, networkEid)) {
        removeComponent(world, GraphLayoutScene, networkEid);
      }
    }
  }

  for (const nodeEid of networkNodeStateQuery(world)) {
    const nodeVisible = NetworkNodeState.visible[nodeEid];
    const nodeId = NetworkNodeState.nodeId[nodeEid];
    const networkEid = NetworkNodeState.networkEid[nodeEid];
    const networkActive = NetworkState.active[networkEid];
    const networkId = NetworkState.networkId[networkEid];
    // const network = world.networks[networkId];
    // const node = network.children[nodeId];

    if (networkActive && nodeVisible) {
      if (!hasComponent(world, GraphLayoutNode, nodeEid)) {
        addComponent(world, GraphLayoutNode, nodeEid);
        GraphLayoutNode.sceneId[nodeEid] = networkId;
        GraphLayoutNode.nodeId[nodeEid] = nodeId;

        addComponent(world, Renderable, nodeEid);
        Renderable.shape[nodeEid] = RenderableShape.Node; //RenderableShape[node.type] || RenderableShape.Node;

        addComponent(world, Position, nodeEid);
        Position.x[nodeEid] = 0;
        Position.y[nodeEid] = 0;

        console.log("SPAWNED NODE FOR", nodeId);
      }
    } else {
      if (hasComponent(world, GraphLayoutNode, nodeEid)) {
        removeComponent(world, GraphLayoutNode, nodeEid);
        removeComponent(world, Renderable, nodeEid);
        removeComponent(world, Position, nodeEid);
      }
    }
  }
});

export function spawnSceneForNetwork(world, network) {
  const sceneEid = spawnGraphLayoutScene(world, network.id, 100);
  world.sceneIdToEid[network.id] = sceneEid;

  // First pass to add all nodes in the scene
  for (const nodeId in network.children) {
    const node = network.children[nodeId];
    spawnNode(world, node);
  }

  // Second pass to add edges using eids of nodes from first pass
  for (const nodeId in network.children) {
    const node = network.children[nodeId];
    for (const toNodeId in node.connections) {
      spawnNodeEdge(
        world,
        network.id,
        world.nodeIdToEntityId[node.id],
        world.nodeIdToEntityId[toNodeId]
      );
    }
  }
}

export function spawnNode(world, node) {
  const eid = addEntity(world);

  addComponent(world, NetworkNodeState, eid);
  NetworkNodeState.networkId[eid] = node.network.id;
  NetworkNodeState.nodeId[eid] = node.id;
  world.nodeIdToEntityId[node.id] = eid;

  addComponent(world, GraphLayoutNode, eid);
  GraphLayoutNode.sceneId[eid] = node.networkId;
  GraphLayoutNode.nodeId[eid] = node.id;

  addComponent(world, Renderable, eid);
  Renderable.shape[eid] = RenderableShape[node.type] || RenderableShape.Node;

  addComponent(world, Position, eid);
  Position.x[eid] = 0;
  Position.y[eid] = 0;

  return eid;
}

export function spawnNodeEdge(world, sceneId, fromEid, toEid) {
  const eid = addEntity(world);
  addComponent(world, GraphLayoutEdge, eid);
  GraphLayoutEdge.sceneId[eid] = sceneId;
  GraphLayoutEdge.from[eid] = fromEid;
  GraphLayoutEdge.to[eid] = toEid;
}

export function spawnGraphLayoutScene(world, sceneId, initialRatio = 100.0) {
  const eid = addEntity(world);
  addComponent(world, GraphLayoutScene, eid);
  GraphLayoutScene.active[eid] = true;
  GraphLayoutScene.sceneId[eid] = sceneId;
  GraphLayoutScene.ratio[eid] = initialRatio;
  return eid;
}

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
