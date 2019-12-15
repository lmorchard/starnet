const seedrandom = Math.seedrandom;

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

export const BaseNode = (seed) => {
  const rng = new seedrandom(seed);
  return [
    rng, 
    {
      seed,
    }
  ];
};

export const Universe = (seed) => ({
  ...BaseNode(seed),
  type: 'universe',
});

export const Galaxy = (seed) => ({
  type: 'galaxy',
});

export const Sector = (seed) => ({
  type: 'sector',
});

export const Constellation = (seed) => ({
  type: 'constellation',
});

export const Star = (seed) => ({
  type: 'star',
});

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