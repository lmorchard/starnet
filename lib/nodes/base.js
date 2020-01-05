import {
  mkrng,
  normalizeCount,
  rngIntRange,
  genName,
  genUniqueHex
} from "../utils.js";

import * as G from "../generators.js";

import { Universe } from "./index.js";

export class BaseNode {
  constructor({
    addr,
    containerAddr = undefined,
    parentAddr = undefined,
    childAddrs = [],
    ...props
  } = {}) {
    this.assign({
      addr,
      rng: mkrng(addr),
      type: this.constructor.name,
      containerAddr,
      parentAddr,
      childAddrs,
      ...props
    });
    this.init(props);
  }

  init({ name, ...props }) {
    return this.assign({
      name: name || genName(this.rng),
      ...props
    });
  }

  assign(props) {
    Object.assign(this, props);
    return this;
  }

  format(indent = " ") {
    const { type, name, addr, flags } = this;
    return `${indent}${addr} ${type}: ${name} ${flags ? flags : ""}`;
  }

  parent() {
    let parentAddr = this.parentAddr;
    if (!parentAddr) {
      const parts = this.addr.split(":");
      if (parts.length <= 1) {
        return undefined;
      }
      parentAddr = parts.slice(0, -1).join(":");
    }
    return Universe.lookup(parentAddr);
  }

  child(addr) {
    if (!this.childAddrs.includes(addr)) {
      return;
    }
    const parent = this.parent();
    if (parent) {
      return parent.child(addr);
    }
  }

  childAt(idx) {
    return this.child(this.childAddrs[idx]);
  }

  *children() {
    for (let addr of this.childAddrs) {
      yield this.child(addr);
    }
  }

  find({ skip = 0, ...props }) {
    return G.value(G.skip(this.findAll(props), skip));
  }

  *findAll(props) {
    let { type, maxLevel = 15, maxIterations = 2500 } = props;
    const matcher = ({ node }) => node instanceof type;
    yield* this.walk({
      maxLevel,
      maxIterations,
      filter: matcher,
      skipChildren: matcher,
      map: ({ node }) => node
    });
  }

  *walk(props = {}) {
    const {
      maxLevel = 3,
      level = 0,
      maxIterations = 500,
      iterations = { count: 0 },
      filter = () => true,
      map = value => value,
      skipChildren = () => false
    } = props;

    if (++iterations.count >= maxIterations) {
      throw new G.TooManyIterationsError(iterations.count);
    }

    const current = { node: this, level, iterations: iterations.count };

    if (filter(current)) {
      yield map(current);
    }

    if (level >= maxLevel) {
      return;
    }

    if (!skipChildren(current)) {
      for (let child of this.children()) {
        yield* child.walk({ ...props, iterations, level: level + 1 });
      }
    }
  }
}

export class ContainerNode extends BaseNode {
  constructor({ addrToChild = {}, ...props } = {}) {
    super({
      addrToChild,
      ...props
    });
  }

  init(props) {
    super.init({
      ...props,
      childAddrs: [...this.childAddrs, ...this.genChildMapTier(this.childMap())]
    });
  }

  childMap() {
    return [];
  }

  genChildMapTier(tierMap) {
    const tierAddrs = [];
    for (let {
      min = 1,
      max = 1,
      class: nodeClass,
      children: subTierMap
    } of tierMap) {
      const count = normalizeCount(rngIntRange(this.rng, min, max));
      for (let idx = 0; idx < count; idx++) {
        let addr = genUniqueHex(this.addr, this.rng, this.addrToChild);
        this.addrToChild[addr] = {
          nodeClass,
          containerAddr: this.addr,
          containerRef: this,
          parentAddr: this.addr,
          childAddrs: subTierMap && this.genChildMapTier(subTierMap)
        };
        tierAddrs.push(addr);
      }
    }
    return tierAddrs;
  }

  root() {
    return this.childAt(0);
  }

  child(addr) {
    if (addr in this.addrToChild) {
      const { nodeClass, ...props } = this.addrToChild[addr];
      return new nodeClass({ addr, ...props });
    }
    return super.child(addr);
  }
}

export class RootNode extends ContainerNode {}
