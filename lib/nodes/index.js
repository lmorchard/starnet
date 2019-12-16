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
  
  dumpNode('0000:0d2b:602d:fcff:8359');
  
  /*
  let child = nodeByAddr('0000:0d2b:602d:fcff:8359');
  console.log(nodeFmt(child));
  
  for (let i = 0; i < 4; i++) {
    child = child.childAt(0);
    console.log(nodeFmt(child));
  }
  
  for (let i = 0; i < child.childAddrs.length; i++) {
    console.log(nodeFmt(child.childAt(i)));
  }
  */
}

function dumpNode(addr) {
  const node = nodeByAddr(addr);
  console.log(nodeFmt(node));

  for (let addr of node.childAddrs) {
    dumpNode(addr);
    //const child = node.child(addr);
    //console.log(nodeFmt(child));    
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
