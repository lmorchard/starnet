"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = wrapImmutableComponent;
const proxyMap = new WeakMap();
const proxyHandler = {
  set(target, prop) {
    throw new Error(`Tried to write to "${target.constructor.getName()}#${String(prop)}" on immutable component. Use .getMutableComponent() to modify a component.`);
  }

};

function wrapImmutableComponent(T, component) {
  if (component === undefined) {
    return undefined;
  }

  let wrappedComponent = proxyMap.get(component);

  if (!wrappedComponent) {
    wrappedComponent = new Proxy(component, proxyHandler);
    proxyMap.set(component, wrappedComponent);
  }

  return wrappedComponent;
}