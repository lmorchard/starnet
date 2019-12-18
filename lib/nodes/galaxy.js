import { NodeWithChildVariants } from './utils.js';
import { Planet } from './planet.js';

export class Galaxy extends NodeWithChildVariants {
  childVariants() {
    return [
      [3, 6, Sector]
    ];
  }
}

export class Sector extends NodeWithChildVariants {
  childVariants() {
    return [
      [3, 9, Constellation]
    ]
  }
}

export class Constellation extends NodeWithChildVariants {
  childVariants() {
    return [
      [3, 9, Star]
    ];
  }
}

export class Star extends NodeWithChildVariants {
  childVariants() {
    return [
      [1, 12, Planet]
    ];
  }
}
