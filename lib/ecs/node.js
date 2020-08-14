import { Component, Types } from './index.js';

export class Node extends Component {}
Node.schema = {
  node: { type: Types.Ref, default: null }
}
