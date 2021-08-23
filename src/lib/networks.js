import {
  defineComponent,
  defineQuery,
  defineSystem,
  Types,
} from "bitecs";
import { rand, genid } from "./utils.js";

export const NetworkNodeRef = defineComponent({
  networkId: Types.i32,
  nodeId: Types.i32,
});

export function spawnNetwork() {

}

export function spawnNetworkNode() {

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
