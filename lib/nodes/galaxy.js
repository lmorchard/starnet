import {
  NodeWithChildVariants,
  NodeWithFlaggedChildren,
} from './utils.js';

import { Planet } from './planet.js';

export class Galaxy extends NodeWithChildVariants {
  init() {
    super.init({
      childVariants: [
        [ 3, 6, Sector ]
      ]
    });
  }
}

export class Sector extends NodeWithChildVariants {
  init() {
    super.init({
      childVariants: [
        [ 3, 9, Constellation ]
      ]
    });
  }
}

export class Constellation extends NodeWithChildVariants {
  init() {
    super.init({
      childVariants: [
        [ 3, 9, Star ]
      ]
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
