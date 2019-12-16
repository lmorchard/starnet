import {
  nodeFmt,
  mkrng,
  genName,
  genAddrs,
  genFlags,
  BaseNode,
  FlagBaseNode
} from './utils.js';

import { Galaxy } from './galaxy.js';

export function initUniverse() {
  console.log('initUniverse');
  const seed = '8675';

  const universe = Universe({ addr: seed });

  let child = universe;

  for (let i = 0; i < 4; i++) {
    child = child.childAt(0);
    console.log(nodeFmt(child));
  }
  
  for (let i = 0; i < child.childAddrs.length; i++) {
    console.log(nodeFmt(child.childAt(i)));
  } 

}

export const nodeByAddr = (addr) => {
  const parts = addr.split(':');
  let child = Universe({ addr: parts[0] });
  for (let idx = 1; idx < parts.length; idx++) {
    const childAddr = parts.slice(0, idx + 1).join(':');
    child = child.child(childAddr);
    if (!child) {
      return undefined;
    }
  }
  return child;
};

export function Universe({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 8);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, childAddrs, childFn: Galaxy }),
    type: 'universe',
    name: 'Known Universe',
  };
}
