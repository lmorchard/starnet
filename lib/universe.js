import xxhash from "https://unpkg.com/xxhash-wasm/esm/xxhash-wasm.js";

export const Universe = (seed) => ({
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