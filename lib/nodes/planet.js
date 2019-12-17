import {
  mkrng,
  NodeWithChildren,
  NodeWithFlaggedChildren,
} from './utils.js';

/*
import {
  Building
} from './building.js';
*/

export class Planet extends NodeWithFlaggedChildren {
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

export class Region extends NodeWithFlaggedChildren {
  constructor({ addr, ...props }) {
    const rng = mkrng(addr);
    let childFlags = [
      [3 * rng(), ['residential', 'wealthy']],
      [2 * rng(), ['residential', 'poor']],
      [4 * rng(), ['industrial']]
    ];
    super({
      rng,
      addr,
      childFlags,
      childClass: City,
      ...props
    });
  }
}

export class City extends NodeWithFlaggedChildren {
  constructor({ addr, ...props }) {
    const rng = mkrng(addr);
    let childFlags = [
      [3 * rng(), ['residential', 'wealthy']],
      [2 * rng(), ['residential', 'poor']],
      [4 * rng(), ['industrial']]
    ];
    super({
      rng,
      addr,
      childFlags,
      childClass: Neighborhood,
      ...props
    });
  }
}

export class Neighborhood extends NodeWithFlaggedChildren {
  constructor({ addr, ...props }) {
    const rng = mkrng(addr);
    let childFlags = [
      [3 * rng(), ['residential', 'wealthy']],
      [2 * rng(), ['residential', 'poor']],
      [4 * rng(), ['industrial']]
    ];
    super({
      rng,
      addr,
      childFlags,
      childClass: undefined, // Building,
      ...props
    });
  }
}

