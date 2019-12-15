const seedrandom = Math.seedrandom;

const rngFactory = (seed) => new Math.seedrandom(seed);

export function initUniverse() {
  console.log('initUniverse');
  const seed = 0xBADD;
  
  const star = Star(seed);
  console.log(star);
}

const pairs = '..LEXEGEZACEBISOUSESARMAINDIREA.ERATENBERALAVETIEDORQUANTEISRION';
function genName(rng) {
  
}

function genRandom(rng, maxIdx = 1000) {
  const indexToRandom = {};
  const randomToIndex = {};
  for (let idx = 0; idx < maxIdx; idx++) {
    let val;
    do {
      val = Math.floor(rng() * 0xffff)
        .toString(16)
        .padStart(4, '0');
    } while (val in randomToIndex);
    indexToRandom[idx] = val;
    randomToIndex[val] = idx;
  }
  return [indexToRandom, randomToIndex];
}

export const genFlags = (seed, spec) => {
  const rng = rngFactory(seed);
  const total = spec.reduce((a, c) => a + c[0], 0); 
  const [toRandom, toIndex] = genRandom(rng, total);
  
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

export const BaseNode = ({ seed, genChild }) => {
  const rng = rngFactory(seed);
  return {
    rng,
    base: {
      seed,
    }
  };
};

export const Universe = (seed) => {
  const { rng, base } = BaseNode(seed);
  return {
    type: 'universe',
    ...base,
  };
}

export const Galaxy = (seed) => ({
  type: 'galaxy',
});

export const Sector = (seed) => ({
  type: 'sector',
});

export const Constellation = (seed) => ({
  type: 'constellation',
});

export const Star = (seed) => {
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
    addrToFlags,
    flagToAddrs,
  };
}

export const Planet = (seed) => ({
  type: 'planet',
});

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