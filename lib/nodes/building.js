import {
  BaseNode,
  NodeWithChildren,
  NodeWithFlaggedChildren,
  NodeWithChildVariants,
} from './utils.js';

export class Building extends NodeWithChildVariants {
  init() {
    const rng = this.rng;
    super.init({
      childVariants: [

      ]
    })
    let childFlags = [
      [3 * rng(), ['populated']],
      [2 * rng(), ['datacenter']],
      [4 * rng(), ['colony']],  
    ];
  }
}

export class Room extends BaseNode {
}
