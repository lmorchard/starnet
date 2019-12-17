export const mkrng = (seed) =>
  new Math.seedrandom(seed);

export const genHex = (rng) =>
  Math.floor(rng() * 0xffff)
    .toString(16)
    .padStart(4, '0');

// Stolen from / inspired by Text Elite from Ian Bell
// www.iancgbell.clara.net/elite/text/
const pairs = '..LEXEGEZACEBISOUSESARMAINDIREA.ERATENBERALAVETIEDORQUANTEISRION';
const pairsCount = Math.floor(pairs.length / 2);
export function genName(rng) {
  let name = '';
  const rounds = 2 + Math.floor(rng() * 3);
  for (let round = 0; round < rounds; round++) {
    const idx = Math.floor(rng() * pairsCount) * 2;
    name += pairs.substring(idx, idx+2);
  }
  name = name.replace(/\./g, '');
  return name.substring(0, 1) + name.substring(1).toLowerCase();
}

const normalizeCount = count => count === true ? 1 : count === false ? 0 : count;

export class BaseNode {
  constructor({
    addr,
    childAddrs = [],
    ...props
  } = {}) {
    Object.assign(this, {
      addr,
      type: this.constructor.name,
      rng: mkrng(addr),
      childAddrs,
      ...props,
    });
    this.init();
  }

  init({ name = undefined, ...props } = {}) {
    return this.assign({
      name: name || genName(this.rng),
      ...props
    });
  }

  assign(props) {
    Object.assign(this, props);
    return this;
  }

  format(indent = ' ') {
    const { type, name, addr, flags } = this;
    return `${indent}${addr} ${type}: ${name} ${flags ? flags : ''}`;
  }

  child() {
    return undefined;
  }

  childAt(idx) {
    return this.child(this.childAddrs[idx]);
  }
}

export class NodeWithChildren extends BaseNode {
  init({ numChildren, childClass, ...props }) {
    const childAddrs = [];
    for (let idx = 0; idx < numChildren; idx++) {
      let val;
      do {
        val = `${this.addr}:${genHex(this.rng)}`
      } while (childAddrs.includes(val));
      childAddrs.push(val);
    }
    super.init({ childClass, childAddrs, ...props });
  }

  child(addr) {
    if (!this.childClass) {
      return undefined;
    }
    return new (this.childClass)({ addr });
  }
}

export class NodeWithChildVariants extends BaseNode {
  init({ childVariants, ...props }) {
    const addrToClass = {};
    for (let [count, childClass] of childVariants) {
      for (let idx = 0, max = normalizeCount(count); idx < max; idx++) {
        let childAddr;
        do {
          childAddr = `${this.addr}:${genHex(this.rng)}`
        } while (childAddr in addrToClass);
        addrToClass[childAddr] = childClass;
      }
    }
    super.init({
      addrToClass,
      childAddrs: Object.keys(addrToClass),
      ...props
    });
  }

  child(addr) {
    const childClass = this.addrToClass[addr];
    if (childClass) {
      return new (childClass)({ addr });
    }
  }
}

export class NodeWithFlaggedChildren extends BaseNode {
  init({ childFlags, childClass, ...props }) {
    const addrToFlags = {};
    const flagToAddrs = {};
    
    for (let [count, flagsTuple] of childFlags) {
      for (let idx = 0, max = normalizeCount(count); idx < max; idx++) {
        let childAddr;
        do {
          childAddr = `${this.addr}:${genHex(this.rng)}`
        } while (childAddr in addrToFlags);
        addrToFlags[childAddr] = flagsTuple;
        for (let flag of flagsTuple) {
          if (!flagToAddrs[flag]) {
            flagToAddrs[flag] = [];
          }
          flagToAddrs[flag].push(childAddr);
        }
      }
    }

    super.init({
      childClass,
      addrToFlags,
      flagToAddrs,
      childAddrs: Object.keys(addrToFlags),
      ...props
    });
  }

  child(addr) {
    if (!this.childClass) {
      return undefined;
    }
    return new (this.childClass)({
      addr,
      flags: this.addrToFlags[addr]
    });
  }
}
