import {
  BaseNode,
  NodeWithFlaggedChildren,
  NodeWithChildVariants,
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

export class City extends NodeWithChildVariants {
  init() {
    const rng = this.rng;
    super.init({
      childVariants: [
        [ 3 * rng(), RichResidentialNeighborhood ],
        [ 3 * rng(), PoorResidentialNeighborhood ],
        [ 5 * rng(), IndustrialNeighborhood ],
        [ 2 * rng(), OfficeParkNeighborhood ],
      ]
    });
  }
}

export class RichResidentialNeighborhood extends BaseNode { }
export class PoorResidentialNeighborhood extends BaseNode { }
export class IndustrialNeighborhood extends BaseNode { }
export class OfficeParkNeighborhood extends BaseNode { }
