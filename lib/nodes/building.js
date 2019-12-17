import {
  BaseNode,
  NodeWithFlaggedChildren,
  NodeWithChildVariants,
} from './utils.js';

export class Building extends BaseNode {
}

export class ApartmentBuilding extends NodeWithChildVariants {
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

export class FamilyApartment extends NodeBase {}

export class HackerApartment extends NodeBase {}

export class GamerApartment extends NodeBase {}

