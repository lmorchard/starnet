const seedrandom = Math.seedrandom;

  
class BaseNode {
  constructor({ addr }) {
    const rng = mkrng(addr);
    assign(this, {
      type: this.constructor.name,
      addr,
      rng,
    });
  }


  nodeFmt() {
    const ({ type, name, addr, flags }) = this; = {}, indent = ' ') =>
  `${indent}${addr} ${type}: ${name} ${flags}`;

}

export function BaseNode({
  addr,
  flags = [],
  childAddrs = [],
  childFn = () => undefined,
}) {
  const child = addr => childAddrs.includes(addr)
    ? childFn({ addr })
    : undefined;
  return {
    addr,
    flags,
    childAddrs,
    child,
    childAt: idx => child(childAddrs[idx]),
  };
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

export const mkrng = (seed) => new Math.seedrandom(seed);

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

export const genHex = (rng) =>
  Math.floor(rng() * 0xffff)
    .toString(16)
    .padStart(4, '0');

export function genAddrs(prefix, rng, maxIdx = 1000) {
  const out = [];
  for (let idx = 0; idx < maxIdx; idx++) {
    let val;
    do {
      val = `${prefix}:${genHex(rng)}`
    } while (out.includes(val));
    out.push(val);
  }
  return out;
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
