"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getName = getName;
exports.componentPropertyName = componentPropertyName;
exports.queryKey = queryKey;
exports.componentRegistered = componentRegistered;
exports.now = exports.hasWindow = void 0;

/**
 * Return the name of a component
 * @param {Component} Component
 * @private
 */
function getName(Component) {
  return Component.name;
}
/**
 * Return a valid property name for the Component
 * @param {Component} Component
 * @private
 */


function componentPropertyName(Component) {
  return getName(Component);
}
/**
 * Get a key from a list of components
 * @param {Array(Component)} Components Array of components to generate the key
 * @private
 */


function queryKey(Components) {
  var ids = [];

  for (var n = 0; n < Components.length; n++) {
    var T = Components[n];

    if (!componentRegistered(T)) {
      throw new Error(`Tried to create a query with an unregistered component`);
    }

    if (typeof T === "object") {
      var operator = T.operator === "not" ? "!" : T.operator;
      ids.push(operator + T.Component._typeId);
    } else {
      ids.push(T._typeId);
    }
  }

  return ids.sort().join("-");
} // Detector for browser's "window"


const hasWindow = typeof window !== "undefined"; // performance.now() "polyfill"

exports.hasWindow = hasWindow;
const now = hasWindow && typeof window.performance !== "undefined" ? performance.now.bind(performance) : Date.now.bind(Date);
exports.now = now;

function componentRegistered(T) {
  return typeof T === "object" && T.Component._typeId !== undefined || T.isComponent && T._typeId !== undefined;
}