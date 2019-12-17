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

export class BaseNode {
  constructor({
    addr,
    childAddrs = [],
    ...props
  }) {
    assign(this, {
      addr,
      type: this.constructor.name,
      rng: mkrng(addr),
      childAddrs,
      ...props,
    });
    this.init();
  }

  init({ name = undefined, ...props }) {
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
  init() {
    super();

    this.childAddrs = [];
    for (let idx = 0; idx < this.numChildren; idx++) {
      let val;
      do {
        val = `${this.addr}:${genHex(this.rng)}`
      } while (this.childAddrs.includes(val));
      this.childAddrs.push(val);
    }
  }

  child(addr) {
    if (!this.childClass) {
      return undefined;
    }
    return new (this.childClass)({ addr });
  }
}

export class NodeWithFlaggedChildren extends BaseNode {
  init() {
    super();

    const addrToFlags = {};
    const flagToAddrs = {};
    
    for (let [count, flagsTuple] of childFlags) {
      if (count === true) {
        count = 1;
      } else if (count === false) {
        count = 0;
      }
      for (let idx = 0; idx < count; idx++) {
        let childAddr;
        do {
          childAddr = `${addr}:${genHex(this.rng)}`
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

    this.assign({
      addrToFlags,
      flagToAddrs,
      childAddrs: Object.keys(addrToFlags),
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
