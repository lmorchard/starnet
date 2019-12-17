export const mkrng = (seed) => new Math.seedrandom(seed);

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
    childAddrs = {},
    childFn = () => undefined,
  }) {
    const rng = mkrng(addr);
    assign(this, {
      type: this.constructor.name,
      addr,
      rng,
      childAddrs,
      childFn,
    });
  }

  child(addr) {
    return this.childAddrs.includes(addr)
      ? this.childFn({ addr })
      : undefined;
  }

  childAt(idx) {
    return this.child(this.childAddrs[idx]);
  }

  format(indent = ' ') {
    const { type, name, addr, flags } = this;
    return `${indent}${addr} ${type}: ${name} ${flags}`;
  }
}

export class NodeWithChildren extends BaseNode {
  constructor({
    numChildren = 0,
    childFn = () => undefined,
    ...props,
  }) {
    const childAddrs = [];
    for (let idx = 0; idx < numChildren; idx++) {
      let val;
      do {
        val = `${prefix}:${genHex(rng)}`
      } while (out.includes(val));
      out.push(val);
    }
    return out;

    super({
      childAddrs,
      ...props,
    })
  }
}

export class BaseNodeWithChildFlags extends BaseNode {
  constructor(props) {
    super({
      ...props
    });
  }

}

export function FlagBaseNode({
  rng,
  addr,
  childFlags,
  childFn,
}) {
  const { addrToFlags, flagToAddrs } = genFlags(addr, rng, childFlags);
  return BaseNode({
    addr,
    flagToAddrs,
    childAddrs: Object.keys(addrToFlags),
    childFn: ({ addr }) => childFn({ addr, flags: addrToFlags[addr] }),
  });
}

export const genFlags = (prefix, rng, spec) => {
  const total = spec.reduce((a, c) => a + c[0], 0); 
  
  const addrToFlags = {};
  const flagToAddrs = {};
  
  for (let [count, flagsTuple] of spec) {
    if (count === true) {
      count = 1;
    } else if (count === false) {
      count = 0;
    }
    for (let idx = 0; idx < count; idx++) {
      let addr;
      do {
        addr = `${prefix}:${genHex(rng)}`
      } while (addr in addrToFlags);
      addrToFlags[addr] = flagsTuple;
      for (let flag of flagsTuple) {
        if (!flagToAddrs[flag]) {
          flagToAddrs[flag] = [];
        }
        flagToAddrs[flag].push(addr);
      }
    }
  }
  return { addrToFlags, flagToAddrs };
};
