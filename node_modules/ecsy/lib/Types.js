"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createType = createType;
exports.Types = exports.cloneClonable = exports.copyCopyable = exports.cloneJSON = exports.copyJSON = exports.cloneArray = exports.copyArray = exports.cloneValue = exports.copyValue = void 0;

const copyValue = src => src;

exports.copyValue = copyValue;

const cloneValue = src => src;

exports.cloneValue = cloneValue;

const copyArray = (src, dest) => {
  if (!src) {
    return src;
  }

  if (!dest) {
    return src.slice();
  }

  dest.length = 0;

  for (let i = 0; i < src.length; i++) {
    dest.push(src[i]);
  }

  return dest;
};

exports.copyArray = copyArray;

const cloneArray = src => src && src.slice();

exports.cloneArray = cloneArray;

const copyJSON = src => JSON.parse(JSON.stringify(src));

exports.copyJSON = copyJSON;

const cloneJSON = src => JSON.parse(JSON.stringify(src));

exports.cloneJSON = cloneJSON;

const copyCopyable = (src, dest) => {
  if (!src) {
    return src;
  }

  if (!dest) {
    return src.clone();
  }

  return dest.copy(src);
};

exports.copyCopyable = copyCopyable;

const cloneClonable = src => src && src.clone();

exports.cloneClonable = cloneClonable;

function createType(typeDefinition) {
  var mandatoryProperties = ["name", "default", "copy", "clone"];
  var undefinedProperties = mandatoryProperties.filter(p => {
    return !typeDefinition.hasOwnProperty(p);
  });

  if (undefinedProperties.length > 0) {
    throw new Error(`createType expects a type definition with the following properties: ${undefinedProperties.join(", ")}`);
  }

  typeDefinition.isType = true;
  return typeDefinition;
}
/**
 * Standard types
 */


const Types = {
  Number: createType({
    name: "Number",
    default: 0,
    copy: copyValue,
    clone: cloneValue
  }),
  Boolean: createType({
    name: "Boolean",
    default: false,
    copy: copyValue,
    clone: cloneValue
  }),
  String: createType({
    name: "String",
    default: "",
    copy: copyValue,
    clone: cloneValue
  }),
  Array: createType({
    name: "Array",
    default: [],
    copy: copyArray,
    clone: cloneArray
  }),
  Ref: createType({
    name: "Ref",
    default: undefined,
    copy: copyValue,
    clone: cloneValue
  }),
  JSON: createType({
    name: "JSON",
    default: null,
    copy: copyJSON,
    clone: cloneJSON
  })
};
exports.Types = Types;