import {
  NodeWithChildren,
  NodeWithFlaggedChildren,
} from './utils.js';

import { Planet } from './planet.js';

export class Galaxy extends NodeWithChildren {
  init() {
    this.assign({
      numChildren: Math.floor(3 + this.rng() * 3),
      childClass: Sector,
    });
    super();
  }
}

export class Sector extends NodeWithChildren {
  init() {
    this.assign({
      numChildren: Math.floor(3 + rng() * 6),
      childClass: Constellation,
    });
    super();
  }
}

export class Constellation extends NodeWithChildren {
  init() {
    this.assign({
      numChildren: Math.floor(3 + rng() * 4),
      childClass: Star,
    });
    super();
  }
}

export class Star extends NodeWithFlaggedChildren {
  init() {
    const speciesRoll = this.rng();  
    let childFlags;
    if (speciesRoll > 0.999) {
      childFlags = [
        [1, ['dysonsphere']],
      ]
    } else {
      childFlags = [
        [this.rng() > 0.2, ['megacity']],
        [this.rng() > 0.99, ['xeno']],
        [3 * this.rng(), ['populated']],
        [2 * this.rng(), ['datacenter']],
        [4 * this.rng(), ['colony']]
      ];
    }
    this.assign({
      childFlags,
      childClass: Planet,
    });
    super();
  }
}
