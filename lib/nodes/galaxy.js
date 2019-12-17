import {
  mkrng,
  genName,
  NodeWithChildren,
  NodeWithFlaggedChildren,
} from './utils.js';

import { Planet } from './planet.js';

export class Galaxy extends NodeWithChildren {
  constructor(props) {
    super({
      numChildren: Math.floor(3 + rng() * 3),
      childClass: Sector,
      ...props
    });
  }
}

export class Sector extends NodeWithChildren {
  constructor(props) {
    super({
      numChildren: Math.floor(3 + rng() * 6),
      childClass: Constellation,
      ...props
    });
  }
}

export function Sector({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 6);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, childAddrs, childFn: Constellation }),
    type: 'sector',
    name: genName(rng),
  };
}

export function Constellation({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 4);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, childAddrs, childFn: Star }),
    type: 'constellation',
    name: genName(rng),
  };
}

export function Star({ addr }) {
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
  
  return {
    ...FlagBaseNode({
      rng,
      addr,
      childFlags,
      childFn: Planet,
    }),
    type: 'star',
    name: genName(rng),
  };
}
