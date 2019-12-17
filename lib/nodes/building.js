import {
  nodeFmt,
  mkrng,
  genName,
  genAddrs,
  genFlags,
  BaseNode,
  FlagBaseNode
} from './utils.js';

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

export function Apartment({ addr, flags }) {
  const rng = mkrng(addr);  
  return {
    ...BaseNode({
      addr,
      flags,
    }),    
    type: 'apartment',
    name: genName(rng),
  };  
}
