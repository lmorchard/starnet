import { RootNode } from './base.js';
import { ApartmentBuilding } from './building.js';

export class Planet extends RootNode {
  childMap() {
    return [
      { min: 1, max: 12, class: Region },
    ];
  }
}

export class Region extends RootNode {
  childMap() {
    return [
      { min: 1, max: 12, class: City },
    ];
  }
}

export class City extends RootNode {
  childMap() {
    return [
      { min: 1, max: 3, class: ApartmentBuilding },
    ];
  }
}

export class Neighborhood extends RootNode { }

export class Starport extends Neighborhood { }

export class RichResidentialNeighborhood extends Neighborhood {
  childMap() {
    return [
      { min: 1, max: 3, class: ApartmentBuilding },
    ];
  }
}

export class PoorResidentialNeighborhood extends Neighborhood {
  childMap() {
    return [
      { min: 1, max: 3, class: ApartmentBuilding },
    ];
  }
}

export class IndustrialNeighborhood extends Neighborhood {
  childMap() {
    return [
      { min: 1, max: 3, class: ApartmentBuilding },
    ];
  }
}

export class OfficeParkNeighborhood extends Neighborhood {
  childMap() {
    return [
      { min: 1, max: 3, class: ApartmentBuilding },
    ];
  }
}
