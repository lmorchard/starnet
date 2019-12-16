const seedrandom = Math.seedrandom;

export function initUniverse() {
  console.log('initUniverse');
  const seed = 'badd';

  const universe = Universe({ addr: seed });
  
  console.log(universe);
}

export function BaseNode({ rng, addr }) {
  return {
    addr,
  };
}

export function Universe({ addr }) {
  const rng = mkrng(addr);
  const numGalaxies = Math.floor(3 + rng() * 8);

  const { indexToRandom, randomToIndex } = genRandom(rng, numGalaxies);
  
  return {
    ...BaseNode({ addr, rng }),
    type: 'universe',
    name: 'Known Universe',
  };
}

export function Galaxy({ addr }) {
  const rng = mkrng(addr);
  return {
    ...BaseNode({ addr, rng }),
    type: 'galaxy',
    name: genName(rng),
  };
};

export function Sector({ addr }) {
  const rng = mkrng(addr);
  return {
    ...BaseNode({ addr, rng }),
    type: 'sector',
    name: genName(rng),
  };
}

export const Constellation = ({ seed }) => ({
  type: 'constellation',
});

export function Star({ seed }) {
  const { rng, base } = BaseNode({ seed });
  
  const { addrToFlags, flagToAddrs } = genFlags(rng(), [
    [4, ['rich']],
    [2, ['datacenter']],
    [10, ['poor']],
    [8, ['farming']],
    [9, ['poor', 'farming']],
  ]);

  return {
    ...base,
    type: 'star',
    name: genName(rng),
    addrToFlags,
    flagToAddrs,
    child: addr => Planet({ seed: addr, flags: addrToFlags[addr] }),
  };
}

export const Planet = ({ seed, flags }) => {
  const { rng, base } = BaseNode({ seed });
  
  return {
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

function genRandom(rng, maxIdx = 1000) {
  const out = [];
  for (let idx = 0; idx < maxIdx; idx++) {
    let val;
    do {
      val = Math.floor(rng() * 0xffff)
        .toString(16)
        .padStart(4, '0');
    } while (out.includes(val));
    out.push(val);
  }
  return out;
}

export const genFlags = (seed, spec) => {
  const rng = mkrng(seed);
  const total = spec.reduce((a, c) => a + c[0], 0); 
  
  const addrToFlags = {};
  const flagToAddrs = {};
  
  for (let [count, flagsTuple] of spec) {
    for (let idx = 0; idx < count; idx++) {
      let addr;
      do {
        addr = Math.floor(rng() * 0xffff)
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
