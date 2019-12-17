import {
  mkrng,
  NodeWithChildren,
  NodeWithFlaggedChildren,
} from './utils.js';

import { Building } from './building.js';

export class Planet extends NodeWithFlaggedChildren {
  init() {
    const rng = this.rng;
    let childFlags = [
      [3 * rng(), ['populated']],
      [2 * rng(), ['datacenter']],
      [4 * rng(), ['colony']],  
    ];
    super.init({
      childFlags,
      childClass: Region,
    });
  }
}

export class Region extends NodeWithFlaggedChildren {
  init() {
    const rng = this.rng;
    let childFlags = [
      [3 * rng(), ['residential', 'wealthy']],
      [2 * rng(), ['residential', 'poor']],
      [4 * rng(), ['industrial']]
    ];
    super.init({
      childFlags,
      childClass: City,
    });
  }
}

export class City extends NodeWithFlaggedChildren {
  init() {
    const rng = this.rng;
    let childFlags = [
      [3 * rng(), ['residential', 'wealthy']],
      [2 * rng(), ['residential', 'poor']],
      [4 * rng(), ['industrial']]
    ];
    super.init({
      childFlags,
      childClass: Neighborhood,
    });
  }
}

export class Neighborhood extends NodeWithFlaggedChildren {
  init() {
    const rng = this.rng;
    let childFlags = [
      [3 * rng(), ['residential', 'wealthy']],
      [2 * rng(), ['residential', 'poor']],
      [4 * rng(), ['industrial']]
    ];
    super.init({
      childFlags,
      childClass: Building,
    });
  }
}
