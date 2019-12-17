import {
  nodeFmt,
  mkrng,
  genName,
  genAddrs,
  genFlags,
  BaseNode,
  FlagBaseNode
} from './utils.js';

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

export function GameConsole({ addr, flags }) {
  const rng = mkrng(addr);
  return {
    ...BaseNode({ addr, flags }),
    type: 'gameconsole',
  } 
}

export function Printer({ addr, flags }) {
  return {
    ...BaseNode({ addr, flags }),
    type: 'printer',    
  }
}

