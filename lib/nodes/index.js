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
  
  dumpNode('0000:0d2b:602d:fcff', 2);
  dumpNode('0000:0d2b:602d:fcff:8359:68bc:708b:4db0', 2);
}

function dumpNode(addr, maxLevel = 3, level = 0) {
  if (level > maxLevel) {
    return;
  }
  
  const node = nodeByAddr(addr);
  if (!node) {
    console.error('no such node');
    return;
  }

  console.log(nodeFmt(node));

  for (let addr of node.childAddrs) {
    dumpNode(addr, maxLevel, level + 1);
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
