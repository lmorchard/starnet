import {
  NodeWithChildren,
  NodeWithFlaggedChildren,
} from './utils.js';

import { Planet } from './planet.js';

export class Galaxy extends NodeWithChildren {
  init() {
    super.init({
      numChildren: Math.floor(3 + this.rng() * 3),
      childClass: Sector,
    });
  }
}

export class Sector extends NodeWithChildren {
  init() {
    super.init({
      numChildren: Math.floor(3 + this.rng() * 6),
      childClass: Constellation,
    });
  }
}

export class Constellation extends NodeWithChildren {
  init() {
    super.init({
      numChildren: Math.floor(3 + this.rng() * 4),
      childClass: Star,
    });
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
    super.init({
      childFlags,
      childClass: Planet,
    });
  }
}
