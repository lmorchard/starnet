import { RootNode } from './base.js';
import { Planet } from './planet.js';

export class Galaxy extends RootNode {
  childMap() {
    return [
      { min: 3, max: 6, class: Sector },
    ];
  }
}

export class Sector extends RootNode {
  childMap() {
    return [
      { min: 3, max: 9, class: Constellation },
    ]
  }
}

export class Constellation extends RootNode {
  childMap() {
    return [
      { min: 3, max: 9, class: Star },
    ];
  }
}

export class Star extends RootNode {
  childMap() {
    return [
      { min: 1, max: 12, class: Planet },
    ];
  }
}
