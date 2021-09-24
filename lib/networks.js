import {
  defineComponent,
  defineQuery,
  defineSystem,
  Types,
  addComponent,
  exitQuery,
  enterQuery,
} from "../vendor/pkg/bitecs.js";
import { genid } from "./randoms.js";

export function init(world) {
  world.nodeIdToEntityId = {};
}

export const NetworkNodeRef = defineComponent({
  networkId: Types.i32,
  nodeId: Types.i32,
});

export const networkNodeRefQuery = defineQuery([NetworkNodeRef]);
export const enterNetworkNodeRefQuery = enterQuery(networkNodeRefQuery);
export const exitNetworkNodeRefQuery = exitQuery(networkNodeRefQuery);

export function addNetworkNodeRef(world, eid, node) {
  addComponent(world, NetworkNodeRef, eid);
  NetworkNodeRef.networkId[eid] = node.network.id;
  NetworkNodeRef.nodeId[eid] = node.id;
  world.nodeIdToEntityId[node.id] = eid;
}

export const networkNodeRefSystem = defineSystem((world) => {
  for (const eid of enterNetworkNodeRefQuery(world)) {
    const nodeId = NetworkNodeRef.nodeId[eid];
    world.nodeIdToEntityId[nodeId] = eid;
  }
  const entries = Object.entries(world.nodeIdToEntityId);
  for (const deletedEid of exitNetworkNodeRefQuery(world)) {
    const result = entries.find(([ nodeId, eid ]) => eid === deletedEid);
    if (result) {
      const [ nodeId ] = result;
      delete world.nodeIdToEntityId[nodeId];
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
