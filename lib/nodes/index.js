import { nodeFmt, mkrng, genName, genAddrs, genFlags, BaseNode, FlagBaseNode } from './utils.js';

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

export function Galaxy({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 3);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, childAddrs, childFn: Sector }),
    type: 'galaxy',
    name: genName(rng),
  };
};

export function Sector({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 6);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, childAddrs, childFn: Constellation }),
    type: 'sector',
    name: genName(rng),
  };
}

export function Constellation({ addr }) {
  const rng = mkrng(addr);
  const numChildren = Math.floor(3 + rng() * 4);
  const childAddrs = genAddrs(addr, rng, numChildren);
  
  return {
    ...BaseNode({ addr, childAddrs, childFn: Star }),
    type: 'constellation',
    name: genName(rng),
  };
}

export function Star({ addr }) {
  const rng = mkrng(addr);
  const speciesRoll = rng();
  
  let childFlags;
  if (speciesRoll > 0.999) {
    childFlags = [
      [1, ['dysonsphere']],
    ]
  } else {
    childFlags = [
      [rng() > 0.2, ['megacity']],
      [rng() > 0.99, ['xeno']],
      [3 * rng(), ['populated']],
      [2 * rng(), ['datacenter']],
      [4 * rng(), ['colony']]
    ];
  }
  
  return {
    ...FlagBaseNode({
      rng,
      addr,
      childFlags,
      childFn: Planet,
    }),
    type: 'star',
    name: genName(rng),
  };
}

export function Building({ addr, flags }) {
  const rng = mkrng(addr);  
  const { addrToFlags, flagToAddrs } = genFlags(addr, rng, [
    [3 * rng(), ['residential', 'wealthy']],
    [2 * rng(), ['residential', 'poor']],
    [4 * rng(), ['industrial']]
  ]);
  return {
    ...BaseNode({
      addr,
      flags,
      childAddrs: Object.keys(addrToFlags),
      childFn: ({ addr }) => Room({ addr, flags: addrToFlags[addr] }),
    }),    
    type: 'building',
    name: genName(rng),
  };
}

export function Room({ addr, flags }) {
  const rng = mkrng(addr);  
  return {
    ...BaseNode({
      addr,
      flags,
    }),    
    type: 'room',
    name: genName(rng),
  };
}

export function WANGateway({ addr, flags }) {
  return {
    ...BaseNode({ addr, flags }),
    type: 'wangateway',
  }
}

export function Firewall({ addr, flags }) {
  return {
    ...BaseNode({ addr, flags }),
    type: 'firewall',
  }
}
