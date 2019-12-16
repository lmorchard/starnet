const seedrandom = Math.seedrandom;

export function initUniverse() {
  console.log('initUniverse');
  const seed = '1234';

  const universe = Universe({ addr: seed });

  let child;
  
  child = universe;
  
  child = child.childAt(0);
  console.log(nodeFmt(child));
  
  child = child.childAt(0);
  console.log(nodeFmt(child));
  
  child = child.childAt(0);
  console.log(nodeFmt(child));
  
  child = child.childAt(0);
  console.log(nodeFmt(child));
  
  child = child.childAt(0);
  console.log(nodeFmt(child));
  
  child = universe;
  
  child = child.childAt(1);
  console.log(nodeFmt(child));
  
  child = child.childAt(0);
  console.log(nodeFmt(child));
  
  child = child.childAt(0);
  console.log(nodeFmt(child));
  
  child = child.childAt(0);
  console.log(nodeFmt(child));
  
  child = child.childAt(0);
  console.log(nodeFmt(child));
  
}

const nodeFmt = ({ type, name, addr, flags }, indent = ' ') =>
  `${indent}${addr} ${type}: ${name} ${flags}`;

export function BaseNode({
  rng,
  addr,
  flags = [],
  childAddrs,
  childFn,
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

export function Universe({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 8);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, rng, childAddrs, childFn: Galaxy }),
    type: 'universe',
    name: 'Known Universe',
  };
}

export function Galaxy({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 3);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, rng, childAddrs, childFn: Sector }),
    type: 'galaxy',
    name: genName(rng),
  };
};

export function Sector({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 4);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, rng, childAddrs, childFn: Constellation }),
    type: 'sector',
    name: genName(rng),
  };
}

export function Constellation({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 4);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, rng, childAddrs, childFn: Star }),
    type: 'constellation',
    name: genName(rng),
  };
}

export function Star({ addr }) {
  const rng = mkrng(addr);
  const { addrToFlags, flagToAddrs } = genFlags(addr, rng, [
    [3 * rng(), ['populated']],
    [2 * rng(), ['datacenter']],
    [4 * rng(), ['colony']]
  ]);
  return {
    ...BaseNode({
      addr,
      rng,
      childAddrs: Object.keys(addrToFlags),
      childFn: ({ addr }) => Planet({ addr, flags: addrToFlags[addr] }),
    }),
    type: 'star',
    name: genName(rng),
    flagToAddrs,
  };
}

export function Planet({ addr, flags }) {
  const rng = mkrng(addr);  
  return {
    ...BaseNode({
      addr,
      flags,
      rng,
      childAddrs: [],
      childFn: Region
    }),
    type: 'planet',
    name: genName(rng),
  };
};

export const Region = (seed) => ({
  type: 'region',
});

export const City = (seed) => ({
  type: 'city',
});

export const Neighborhood = (seed) => ({
  type: 'neighborhood',
});

export const Building = (seed) => ({ 
  type: 'building',
});

export const Room = (seed) => ({
  type: 'room',
});

export const Device = (seed) => ({
  type: 'device',
});

const mkrng = (seed) => new Math.seedrandom(seed);

const pairs = '..LEXEGEZACEBISOUSESARMAINDIREA.ERATENBERALAVETIEDORQUANTEISRION';
function genName(rng) {
  let name = '';
  const rounds = 2 + Math.floor(rng() * 4);
  for (let round = 0; round < rounds; round++) {
    const idx = Math.floor(rng() * (pairs.length / 2)) * 2;
    name += pairs.substring(idx, idx+2);  
  }
  name = name.replace(/\./g, '');
  return name.substring(0, 1) + name.substring(1).toLowerCase();
}

function genAddrs(prefix, rng, maxIdx = 1000) {
  const out = [];
  for (let idx = 0; idx < maxIdx; idx++) {
    let val;
    do {
      val = Math.floor(rng() * 0xffff)
        .toString(16)
        .padStart(4, '0');
    } while (out.includes(val));
    out.push(`${prefix}:${val}`);
  }
  return out;
}

export const genFlags = (prefix, rng, spec) => {
  const total = spec.reduce((a, c) => a + c[0], 0); 
  
  const addrToFlags = {};
  const flagToAddrs = {};
  
  for (let [count, flagsTuple] of spec) {
    for (let idx = 0; idx < count; idx++) {
      let addr;
      do {
        addr = prefix + ':' + Math.floor(rng() * 0xffff)
          .toString(16)
          .padStart(4, '0');
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
