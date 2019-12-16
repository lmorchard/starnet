const seedrandom = Math.seedrandom;

export function initUniverse() {
  console.log('initUniverse');
  const seed = '1234';

  const universe = Universe({ addr: seed });

  let child = universe;
    
  for (let i = 0; i < 10; i++) {
    console.log(nodeFmt(child));    
    child = child.childAt(0);
  }  
}

const nodeFmt = ({ type, name, addr, flags }, indent = ' ') =>
  `${indent}${addr} ${type}: ${name} ${flags}`;

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

export function Universe({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 8);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, childAddrs, childFn: Galaxy }),
    type: 'universe',
    name: 'Known Universe',
  };
}

export function Galaxy({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 3);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, childAddrs, childFn: Sector }),
    type: 'galaxy',
    name: genName(rng),
  };
};

export function Sector({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 4);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, childAddrs, childFn: Constellation }),
    type: 'sector',
    name: genName(rng),
  };
}

export function Constellation({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 4);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, childAddrs, childFn: Star }),
    type: 'constellation',
    name: genName(rng),
  };
}

export function Star({ addr }) {
  const rng = mkrng(addr);
  
  const { addrToFlags, flagToAddrs } = genFlags(addr, rng, [
    [rng() > 0.9, ['megacity']],
    [rng() > 0.99, ['xeno']],
    [3 * rng(), ['populated']],
    [2 * rng(), ['datacenter']],
    [4 * rng(), ['colony']]
  ]);
  
  return {
    ...BaseNode({
      addr,
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
  const { addrToFlags, flagToAddrs } = genFlags(addr, rng, [
    [3 * rng(), ['populated']],
    [2 * rng(), ['datacenter']],
    [4 * rng(), ['colony']]
  ]);
  return {
    ...BaseNode({
      addr,
      flags,
      childAddrs: Object.keys(addrToFlags),
      childFn: ({ addr }) => Region({ addr, flags: addrToFlags[addr] }),
    }),
    type: 'planet',
    name: genName(rng),
  };
};

export function Region({ addr, flags }) {
  const rng = mkrng(addr);  
  const { addrToFlags, flagToAddrs } = genFlags(addr, rng, [
    [3 * rng(), ['residential', 'wealthy']],
    [2 * rng(), ['residential', 'poor']],
    [4 * rng(), ['industrial']]
  ]);
  return {
    ...BaseNode({
      addr,
      flags,
      childAddrs: Object.keys(addrToFlags),
      childFn: ({ addr }) => City({ addr, flags: addrToFlags[addr] }),
    }),
    type: 'region',
    name: genName(rng),
  };
};

export function City({ addr, flags }) {
  const rng = mkrng(addr);  
  const { addrToFlags, flagToAddrs } = genFlags(addr, rng, [
    [3 * rng(), ['residential', 'wealthy']],
    [2 * rng(), ['residential', 'poor']],
    [4 * rng(), ['industrial']]
  ]);
  return {
    ...BaseNode({
      addr,
      flags,
      childAddrs: Object.keys(addrToFlags),
      childFn: ({ addr }) => Neighborhood({ addr, flags: addrToFlags[addr] }),
    }),
    type: 'city',
    name: genName(rng),
  };
};

export function Neighborhood({ addr, flags }) {
  const rng = mkrng(addr);  
  const { addrToFlags, flagToAddrs } = genFlags(addr, rng, [
    [3 * rng(), ['residential', 'wealthy']],
    [2 * rng(), ['residential', 'poor']],
    [4 * rng(), ['industrial']]
  ]);
  return {
    ...BaseNode({
      addr,
      flags,
      childAddrs: Object.keys(addrToFlags),
      childFn: ({ addr }) => Building({ addr, flags: addrToFlags[addr] }),
    }),
    type: 'neighborhood',
    name: genName(rng),
  };
};

export function Building({ addr, flags }) {
  const rng = mkrng(addr);  
  const { addrToFlags, flagToAddrs } = genFlags(addr, rng, [
    [3 * rng(), ['residential', 'wealthy']],
    [2 * rng(), ['residential', 'poor']],
    [4 * rng(), ['industrial']]
  ]);
  return {
    ...BaseNode({
      addr,
      flags,
      childAddrs: Object.keys(addrToFlags),
      childFn: ({ addr }) => Room({ addr, flags: addrToFlags[addr] }),
    }),    
    type: 'building',
    name: genName(rng),
  };
}

export function Room({ addr, flags }) {
  const rng = mkrng(addr);  
  return {
    ...BaseNode({
      addr,
      flags,
    }),    
    type: 'room',
    name: genName(rng),
  };
}

export const Device = (seed) => ({
  type: 'device',
});

const mkrng = (seed) => new Math.seedrandom(seed);

// Stolen from / inspired by Text Elite from Ian Bell
// www.iancgbell.clara.net/elite/text/
const pairs = '..LEXEGEZACEBISOUSESARMAINDIREA.ERATENBERALAVETIEDORQUANTEISRION';
const pairsCount = Math.floor(pairs.length / 2);
function genName(rng) {
  let name = '';
  const rounds = 2 + Math.floor(rng() * 3);
  for (let round = 0; round < rounds; round++) {
    const idx = Math.floor(rng() * pairsCount) * 2;
    name += pairs.substring(idx, idx+2);
  }
  name = name.replace(/\./g, '');
  return name.substring(0, 1) + name.substring(1).toLowerCase();
}

const genHex = (rng) =>
  Math.floor(rng() * 0xffff)
    .toString(16)
    .padStart(4, '0');

function genAddrs(prefix, rng, maxIdx = 1000) {
  const out = [];
  for (let idx = 0; idx < maxIdx; idx++) {
    let val;
    do {
      val = genHex(rng)
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
