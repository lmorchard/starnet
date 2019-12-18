import { BaseNode, NodeWithChildVariants } from './utils.js';

export class Building extends BaseNode { }

export class ApartmentBuilding extends NodeWithChildVariants {
  init() {
    const rng = this.rng;
    super.init({
      childVariants: [
        [ 0, 3, RichResidentialNeighborhood ],
        [ 0, 3, PoorResidentialNeighborhood ],
        [ 0, 5, IndustrialNeighborhood ],
        [ 0, 2, OfficeParkNeighborhood ],
      ]
    });
  }
}

export class FamilyApartment extends BaseNode {}

export class HackerApartment extends BaseNode {}

export class GamerApartment extends BaseNode {}
