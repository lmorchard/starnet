import {
  mkrng,
  NodeWithChildVariants,
} from './utils.js';

const assign = Object.assign;

import { Galaxy } from './galaxy.js';

export function initUniverse() {
  console.log('initUniverse');
  let child = new Universe({ addr: '0000' });
  for (let idx = 0; idx < 7; idx++) {
    console.log(child.format());
    child = child.childAt(0);
  }
  console.log('-----');
  Universe.dump(child.addr, 2);
}

export class Universe extends NodeWithChildVariants {
  init() {
    super.init({
      name: 'Known universe',
      childVariants: [
        [ 3 + this.rng() * 8, Galaxy ]
      ]
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
  
  static dump(addr, maxLevel = 1, level = 0) {
    if (level >= maxLevel) {
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
