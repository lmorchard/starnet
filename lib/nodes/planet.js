import {
  nodeFmt,
  mkrng,
  genName,
  genAddrs,
  genFlags,
  BaseNode,
  FlagBaseNode
} from './utils.js';

import {
  Building
} from './building.js';

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
