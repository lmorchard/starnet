import {
  mkrng,
  NodeWithChildren,
  NodeWithFlaggedChildren,
} from './utils.js';

export class Building extends NodeWithFlaggedChildren {
  init() {
    const rng = this.rng;
    let childFlags = [
      [3 * rng(), ['populated']],
      [2 * rng(), ['datacenter']],
      [4 * rng(), ['colony']],  
    ];
    super.init({
      childFlags,
      childClass: Room,
    });
  }
}

export class Room extends NodeWithFlaggedChildren {
  init() {
    const rng = this.rng;
    let childFlags = [
      [3 * rng(), ['populated']],
      [2 * rng(), ['datacenter']],
      [4 * rng(), ['colony']],  
    ];
    super.init({
      childFlags,
      childClass: Room,
    });
  }
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
