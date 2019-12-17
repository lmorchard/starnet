import {
  nodeFmt,
  mkrng,
  genName,
  genAddrs,
  genFlags,
  BaseNode,
  NodeWithChildren,
  
  FlagBaseNode
} from './utils.js';

const assign = Object.assign;

import { Galaxy } from './galaxy.js';

export function initUniverse() {
  console.log('initUniverse');
  
  Universe.dump('0000:0d2b:602d:fcff', 2);
  Universe.dump('0000:0d2b:602d:fcff:8359:68bc:708b:4db0', 2);
}

class Universe extends BaseNode {
  constructor(props) {
    super(props);

    const numChildren = Math.floor(3 + rng() * 8);
    const childAddrs = genAddrs(addr, rng, numChildren);
     
    assign(this, {
      name: 'Known universe',
    });
  }

  static lookup(addr) {
    const [ addr, ...rest ] = addr.split(':');
    let child = new Universe({ addr });
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
    console.log(node.format(node));
    for (let addr of node.childAddrs) {
      Universe.dump(addr, maxLevel, level + 1);
    }  
  }
}
