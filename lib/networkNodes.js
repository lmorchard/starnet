import { mkrng, genHex } from "./randoms.js";

export class NetworkNode {
  parent = null;
  connections = {};

  defaultOptions() {
    return {
      prefix: "0000",
    };
  }

  constructor(optionsIn = {}) {
    const options = {
      ...this.defaultOptions(),
      ...optionsIn,
    };

    const rng = options.rng;

    const {
      id = `${options.prefix}:${genHex(rng)}`,
      nodeClass = this.constructor.name,
    } = options;

    Object.assign(this, {
      ...options,
      id,
      rng,
      nodeClass,
    });

    this.initialize();
  }

  initialize() {}

  skipToJSON() {
    return ["parent", "connections"];
  }

  toJSON() {
    const out = {};
    const skipKeys = this.skipToJSON();
    for (const [key, value] of Object.entries(this)) {
      if (skipKeys.includes(key)) {
        continue;
      }
      out[key] = value;
    }
    out.parent = this.parent && this.parent.id;
    out.connections = [];
    for (const key of Object.keys(this.connections)) {
      out.connections.push(key);
    }
    return out;
  }

  static fromJSON(data) {
    // TODO
  }

  connectTo(other, bidirectional = true) {
    this.connections[other.id] = other;
    if (bidirectional) {
      other.connectTo(this, false);
    }
  }
}

export class NetworkParentNode extends NetworkNode {
  children = {};

  initialize() {
    this.childRng = mkrng(this.id);
  }

  createChild(NodeClass, optionsIn = {}) {
    const child = new NodeClass({
      ...optionsIn,
      parent: this,
      prefix: this.id,
      rng: this.childRng,
    });
    this.children[child.id] = child;
    return child;
  }

  skipToJSON() {
    return [...super.skipToJSON(), "children"];
  }

  toJSON() {
    const out = super.toJSON();
    out.children = {};
    for (const [id, child] of Object.entries(this.children)) {
      const childOut = child.toJSON();
      delete childOut.parent;
      out.children[id] = childOut;
    }
    return out;
  }

  static fromJSON(data) {
    // TODO
  }
}

export class GatewayNode extends NetworkParentNode {}

export class FirewallNode extends NetworkNode {}

export class RouterNode extends NetworkNode {}

export class StorageNode extends NetworkNode {}

export class AuditLogNode extends NetworkNode {}

export class SecurityMonitorNode extends NetworkNode {}
