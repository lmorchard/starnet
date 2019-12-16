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
