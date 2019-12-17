import {
  mkrng,
  NodeWithChildren,
  NodeWithFlaggedChildren,
} from './utils.js';

export class Building extends NodeWithFlaggedChildren {
  constructor({ addr, ...props }) {
    const rng = mkrng(addr);
    let childFlags = [
      [3 * rng(), ['populated']],
      [2 * rng(), ['datacenter']],
      [4 * rng(), ['colony']],  
    ];
    super({
      rng,
      addr,
      childFlags,
      childClass: Region,
      ...props
    });
  }
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
