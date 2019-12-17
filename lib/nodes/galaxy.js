import { NodeWithChildVariants } from './utils.js';

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

export class Star extends NodeWithChildVariants {
  init() {
    super.init({
      childVariants: [
        [ 1, 12, Planet ]
      ]
    });
  }
}
