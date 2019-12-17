import {
  mkrng,
  NodeWithChildren,
} from './utils.js';

const assign = Object.assign;

import { Galaxy } from './galaxy.js';

export function initUniverse() {
  console.log('initUniverse');
  
  // Universe.dump('0000:0d2b:2143:4252:88ff:d10d:0f8b:5bca', 3);
  Universe.dump(' 0000:0d2b:2143:4252:88ff:d10d:0f8b:5bca:c48c:a9c5', 3);
}

export class Universe extends NodeWithChildren {
  init() {
    super.init({
      name: 'Known universe',
      numChildren: Math.floor(3 + this.rng() * 8),
      childClass: Galaxy,
    });
  }

  static lookup(addr) {
    const parts = addr.split(':');
    let child = new Universe({ addr: parts[0] });
    for (let idx = 1; idx < parts.length; idx++) {
      const childAddr = parts.slice(0, idx + 1).join(':');
      child = child.child(childAddr);
      if (!child) {
        return undefined;
      }
    }
    return child;
  }
  
  static dump(addr, maxLevel = 3, level = 0) {
    if (level > maxLevel) {
      return;
    }
    const node = Universe.lookup(addr);
    if (!node) {
      console.error('no such node');
      return;
    }
    console.log(node.format());
    for (let addr of node.childAddrs) {
      Universe.dump(addr, maxLevel, level + 1);
    }  
  }
}
