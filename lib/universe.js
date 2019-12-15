const seedrandom = Math.seedrandom;

export function initUniverse() {
  console.log('initUniverse');
  const seed = 8675309;
  
  const star = Star(seed);
  console.log(star);
}

function genRandom(rng, seed, maxIdx = 1000) {
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

export const BaseNode = ({ seed, genChild }) => {
  const rng = new seedrandom(seed);
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

export const genFlagsFactory = (spec) -

export const Star = (seed) => {
  const { rng, base } = BaseNode({ seed });
  const genFlags = genFlagsFactory([
  ]);
  return {
    ...base,
    type: 'star',
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