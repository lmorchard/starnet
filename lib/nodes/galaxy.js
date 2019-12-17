import {
  mkrng,
  genName,
  NodeWithChildren,
  NodeWithFlaggedChildren,
} from './utils.js';

// import { Planet } from './planet.js';

export class Galaxy extends NodeWithChildren {
  constructor({ addr, ...props }) {
    const rng = mkrng(addr);
    super({
      rng,
      addr,
      numChildren: Math.floor(3 + rng() * 3),
      childClass: Sector,
      ...props
    });
  }
}

export class Sector extends NodeWithChildren {
  constructor({ addr, ...props }) {
    const rng = mkrng(addr);
    super({
      rng,
      addr,
      numChildren: Math.floor(3 + rng() * 6),
      childClass: Constellation,
      ...props
    });
  }
}

export class Constellation extends NodeWithChildren {
  constructor({ addr, ...props }) {
    const rng = mkrng(addr);
    super({
      rng,
      addr,
      numChildren: Math.floor(3 + rng() * 4),
      childClass: Star,
      ...props
    });
  }
}

export class Star extends NodeWithFlaggedChildren {
  constructor({ addr, ...props }) {
    const rng = mkrng(addr);
    const speciesRoll = rng();
  
    let childFlags;
    if (speciesRoll > 0.999) {
      childFlags = [
        [1, ['dysonsphere']],
      ]
    } else {
      childFlags = [
        [rng() > 0.2, ['megacity']],
        [rng() > 0.99, ['xeno']],
        [3 * rng(), ['populated']],
        [2 * rng(), ['datacenter']],
        [4 * rng(), ['colony']]
      ];
    }
    super({
      rng,
      addr,
      childFlags,
      childClass: undefined, // Planet,
      ...props
    });
  }
}
