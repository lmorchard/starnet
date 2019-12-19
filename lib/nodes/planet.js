import { BaseNode, NodeWithChildVariants } from './utils.js';
import { Building } from './building.js';

export class Planet extends NodeWithChildVariants {
  childVariants() {
    return [
      [ 1, 12, Region ],
    ];
  }
}

export class Region extends NodeWithChildVariants {
  childVariants() {
    return [
      [ -3, 1, Starport ],
      [ 1, 12, City ],
    ];
  }
}

export class City extends NodeWithChildVariants {
  childVariants() {
    return [
      [ 0, 3, RichResidentialNeighborhood ],
      [ 0, 3, PoorResidentialNeighborhood ],
      [ 0, 5, IndustrialNeighborhood ],
      [ 0, 2, OfficeParkNeighborhood ],
    ];
  }
}

export class Starport extends BaseNode { }

export class RichResidentialNeighborhood extends BaseNode { }
export class PoorResidentialNeighborhood extends BaseNode { }
export class IndustrialNeighborhood extends BaseNode { }
export class OfficeParkNeighborhood extends BaseNode { }
