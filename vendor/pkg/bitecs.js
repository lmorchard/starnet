const TYPES_ENUM = {
  i8: 'i8',
  ui8: 'ui8',
  ui8c: 'ui8c',
  i16: 'i16',
  ui16: 'ui16',
  i32: 'i32',
  ui32: 'ui32',
  f32: 'f32',
  f64: 'f64',
  eid: 'eid'
};
const TYPES_NAMES = {
  i8: 'Int8',
  ui8: 'Uint8',
  ui8c: 'Uint8Clamped',
  i16: 'Int16',
  ui16: 'Uint16',
  i32: 'Int32',
  ui32: 'Uint32',
  eid: 'Uint32',
  f32: 'Float32',
  f64: 'Float64'
};
const TYPES = {
  i8: Int8Array,
  ui8: Uint8Array,
  ui8c: Uint8ClampedArray,
  i16: Int16Array,
  ui16: Uint16Array,
  i32: Int32Array,
  ui32: Uint32Array,
  f32: Float32Array,
  f64: Float64Array,
  eid: Uint32Array
};
const UNSIGNED_MAX = {
  uint8: 2 ** 8,
  uint16: 2 ** 16,
  uint32: 2 ** 32
};

const roundToMultiple4 = x => Math.ceil(x / 4) * 4;

const $storeRef = Symbol('storeRef');
const $storeSize = Symbol('storeSize');
const $storeMaps = Symbol('storeMaps');
const $storeFlattened = Symbol('storeFlattened');
const $storeBase = Symbol('storeBase');
const $storeType = Symbol('storeType');
const $storeArrayCounts = Symbol('storeArrayCount');
const $storeSubarrays = Symbol('storeSubarrays');
const $subarrayCursors = Symbol('subarrayCursors');
const $subarray = Symbol('subarray');
const $subarrayFrom = Symbol('subarrayFrom');
const $subarrayTo = Symbol('subarrayTo');
const $parentArray = Symbol('subStore');
const $tagStore = Symbol('tagStore');
const $indexType = Symbol('indexType');
const $indexBytes = Symbol('indexBytes');
const $isEidType = Symbol('isEidType');
const stores = {};
const resize = (ta, size) => {
  const newBuffer = new ArrayBuffer(size * ta.BYTES_PER_ELEMENT);
  const newTa = new ta.constructor(newBuffer);
  newTa.set(ta, 0);
  return newTa;
};
const createShadow = (store, key) => {
  if (!ArrayBuffer.isView(store)) {
    const shadowStore = store[$parentArray].slice(0).fill(0);
    store[key] = store.map((_, eid) => {
      const from = store[eid][$subarrayFrom];
      const to = store[eid][$subarrayTo];
      return shadowStore.subarray(from, to);
    });
  } else {
    store[key] = store.slice(0).fill(0);
  }
};

const resizeSubarray = (metadata, store, size) => {
  const cursors = metadata[$subarrayCursors];
  let type = store[$storeType];
  const length = store[0].length;
  const indexType = length <= UNSIGNED_MAX.uint8 ? 'ui8' : length <= UNSIGNED_MAX.uint16 ? 'ui16' : 'ui32';
  const arrayCount = metadata[$storeArrayCounts][type];
  const summedLength = Array(arrayCount).fill(0).reduce((a, p) => a + length, 0); // // for threaded impl
  // // const summedBytesPerElement = Array(arrayCount).fill(0).reduce((a, p) => a + TYPES[type].BYTES_PER_ELEMENT, 0)
  // // const totalBytes = roundToMultiple4(summedBytesPerElement * summedLength * size)
  // // const buffer = new SharedArrayBuffer(totalBytes)

  const array = new TYPES[type](roundToMultiple4(summedLength * size)); // console.log(array.length, metadata[$storeSubarrays][type].length, type)

  array.set(metadata[$storeSubarrays][type]);
  metadata[$storeSubarrays][type] = array;
  array[$indexType] = TYPES_NAMES[indexType];
  array[$indexBytes] = TYPES[indexType].BYTES_PER_ELEMENT; // create buffer for type if it does not already exist
  // if (!metadata[$storeSubarrays][type]) {
  //   const arrayCount = metadata[$storeArrayCounts][type]
  //   const summedLength = Array(arrayCount).fill(0).reduce((a, p) => a + length, 0)
  //   // for threaded impl
  //   // const summedBytesPerElement = Array(arrayCount).fill(0).reduce((a, p) => a + TYPES[type].BYTES_PER_ELEMENT, 0)
  //   // const totalBytes = roundToMultiple4(summedBytesPerElement * summedLength * size)
  //   // const buffer = new SharedArrayBuffer(totalBytes)
  //   const array = new TYPES[type](roundToMultiple4(summedLength * size))
  //   // console.log(`array of type ${type} has size of ${array.length}`)
  //   metadata[$storeSubarrays][type] = array
  //   array[$indexType] = TYPES_NAMES[indexType]
  //   array[$indexBytes] = TYPES[indexType].BYTES_PER_ELEMENT
  // }

  const start = cursors[type];
  let end = 0;

  for (let eid = 0; eid < size; eid++) {
    const from = cursors[type] + eid * length;
    const to = from + length;
    store[eid] = metadata[$storeSubarrays][type].subarray(from, to);
    store[eid][$subarrayFrom] = from;
    store[eid][$subarrayTo] = to;
    store[eid][$subarray] = true;
    store[eid][$indexType] = TYPES_NAMES[indexType];
    store[eid][$indexBytes] = TYPES[indexType].BYTES_PER_ELEMENT;
    end = to;
  }

  cursors[type] = end;
  store[$parentArray] = metadata[$storeSubarrays][type].subarray(start, end);
};

const resizeRecursive = (metadata, store, size) => {
  Object.keys(store).forEach(key => {
    const ta = store[key];

    if (Array.isArray(ta)) {
      // store[$storeSubarrays] = {}
      // store[$subarrayCursors] = Object.keys(TYPES).reduce((a, type) => ({ ...a, [type]: 0 }), {})
      resizeSubarray(metadata, ta, size);
      store[$storeFlattened].push(ta);
    } else if (ArrayBuffer.isView(ta)) {
      store[key] = resize(ta, size);
      store[$storeFlattened].push(store[key]);
    } else if (typeof ta === 'object') {
      resizeRecursive(metadata, store[key], size);
    }
  });
};

const resizeStore = (store, size) => {
  if (store[$tagStore]) return;
  store[$storeSize] = size;
  store[$storeFlattened].length = 0;
  Object.keys(store[$subarrayCursors]).forEach(k => {
    store[$subarrayCursors][k] = 0;
  });
  resizeRecursive(store, store, size);
};
const resetStoreFor = (store, eid) => {
  if (store[$storeFlattened]) {
    store[$storeFlattened].forEach(ta => {
      if (ArrayBuffer.isView(ta)) ta[eid] = 0;else ta[eid].fill(0);
    });
  }
};

const createTypeStore = (type, length) => {
  const totalBytes = length * TYPES[type].BYTES_PER_ELEMENT;
  const buffer = new ArrayBuffer(totalBytes);
  const store = new TYPES[type](buffer);
  store[$isEidType] = type === TYPES_ENUM.eid;
  return store;
};

const createArrayStore = (metadata, type, length) => {
  const size = metadata[$storeSize];
  const store = Array(size).fill(0);
  store[$storeType] = type;
  store[$isEidType] = type === TYPES_ENUM.eid;
  const cursors = metadata[$subarrayCursors];
  const indexType = length < UNSIGNED_MAX.uint8 ? 'ui8' : length < UNSIGNED_MAX.uint16 ? 'ui16' : 'ui32';
  if (!length) throw new Error('bitECS - Must define component array length');
  if (!TYPES[type]) throw new Error(`bitECS - Invalid component array property type ${type}`); // create buffer for type if it does not already exist

  if (!metadata[$storeSubarrays][type]) {
    const arrayCount = metadata[$storeArrayCounts][type];
    const summedLength = Array(arrayCount).fill(0).reduce((a, p) => a + length, 0); // for threaded impl
    // const summedBytesPerElement = Array(arrayCount).fill(0).reduce((a, p) => a + TYPES[type].BYTES_PER_ELEMENT, 0)
    // const totalBytes = roundToMultiple4(summedBytesPerElement * summedLength * size)
    // const buffer = new SharedArrayBuffer(totalBytes)

    const array = new TYPES[type](roundToMultiple4(summedLength * size)); // console.log(`array of type ${type} has size of ${array.length}`)

    metadata[$storeSubarrays][type] = array;
    array[$indexType] = TYPES_NAMES[indexType];
    array[$indexBytes] = TYPES[indexType].BYTES_PER_ELEMENT;
  } // pre-generate subarrays for each eid


  const start = cursors[type];
  let end = 0;

  for (let eid = 0; eid < size; eid++) {
    const from = cursors[type] + eid * length;
    const to = from + length;
    store[eid] = metadata[$storeSubarrays][type].subarray(from, to);
    store[eid][$subarrayFrom] = from;
    store[eid][$subarrayTo] = to;
    store[eid][$subarray] = true;
    store[eid][$indexType] = TYPES_NAMES[indexType];
    store[eid][$indexBytes] = TYPES[indexType].BYTES_PER_ELEMENT;
    end = to;
  }

  cursors[type] = end;
  store[$parentArray] = metadata[$storeSubarrays][type].subarray(start, end);
  return store;
};

const isArrayType = x => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'number';

const createStore = (schema, size) => {
  const $store = Symbol('store');

  if (!schema || !Object.keys(schema).length) {
    // tag component
    stores[$store] = {
      [$storeSize]: size,
      [$tagStore]: true,
      [$storeBase]: () => stores[$store]
    };
    return stores[$store];
  }

  schema = JSON.parse(JSON.stringify(schema));
  const arrayCounts = {};

  const collectArrayCounts = s => {
    const keys = Object.keys(s);

    for (const k of keys) {
      if (isArrayType(s[k])) {
        if (!arrayCounts[s[k][0]]) arrayCounts[s[k][0]] = 0;
        arrayCounts[s[k][0]]++;
      } else if (s[k] instanceof Object) {
        collectArrayCounts(s[k]);
      }
    }
  };

  collectArrayCounts(schema);
  const metadata = {
    [$storeSize]: size,
    [$storeMaps]: {},
    [$storeSubarrays]: {},
    [$storeRef]: $store,
    [$subarrayCursors]: Object.keys(TYPES).reduce((a, type) => ({ ...a,
      [type]: 0
    }), {}),
    [$storeFlattened]: [],
    [$storeArrayCounts]: arrayCounts
  };

  if (schema instanceof Object && Object.keys(schema).length) {
    const recursiveTransform = (a, k) => {
      if (typeof a[k] === 'string') {
        a[k] = createTypeStore(a[k], size);

        a[k][$storeBase] = () => stores[$store];

        metadata[$storeFlattened].push(a[k]);
      } else if (isArrayType(a[k])) {
        const [type, length] = a[k];
        a[k] = createArrayStore(metadata, type, length);

        a[k][$storeBase] = () => stores[$store];

        metadata[$storeFlattened].push(a[k]); // Object.seal(a[k])
      } else if (a[k] instanceof Object) {
        a[k] = Object.keys(a[k]).reduce(recursiveTransform, a[k]); // Object.seal(a[k])
      }

      return a;
    };

    stores[$store] = Object.assign(Object.keys(schema).reduce(recursiveTransform, schema), metadata);

    stores[$store][$storeBase] = () => stores[$store]; // Object.seal(stores[$store])


    return stores[$store];
  }
};

const SparseSet = () => {
  const dense = [];
  const sparse = [];

  dense.sort = function (comparator) {
    const result = Array.prototype.sort.call(this, comparator);

    for (let i = 0; i < dense.length; i++) {
      sparse[dense[i]] = i;
    }

    return result;
  };

  const has = val => dense[sparse[val]] === val;

  const add = val => {
    if (has(val)) return;
    sparse[val] = dense.push(val) - 1;
  };

  const remove = val => {
    if (!has(val)) return;
    const index = sparse[val];
    const swapped = dense.pop();

    if (swapped !== val) {
      dense[index] = swapped;
      sparse[swapped] = index;
    }
  };

  return {
    add,
    remove,
    has,
    sparse,
    dense
  };
};

const $entityMasks = Symbol('entityMasks');
const $entityComponents = Symbol('entityMasks');
const $entitySparseSet = Symbol('entitySparseSet');
const $entityArray = Symbol('entityArray');
let defaultSize = 100000; // need a global EID cursor which all worlds and all components know about
// so that world entities can posess entire rows spanning all component tables

let globalEntityCursor = 0;
let globalSize = defaultSize;

const getGlobalSize = () => globalSize; // removed eids should also be global to prevent memory leaks

const removed = [];
const getDefaultSize = () => defaultSize;
const getEntityCursor = () => globalEntityCursor;
const eidToWorld = new Map();
/**
 * Adds a new entity to the specified world.
 *
 * @param {World} world
 * @returns {number} eid
 */

const addEntity = world => {
  const eid = removed.length > 0 ? removed.shift() : globalEntityCursor++;
  world[$entitySparseSet].add(eid);
  eidToWorld.set(eid, world);

  if (globalEntityCursor >= defaultSize) {
    console.error(`bitECS - max entities of ${defaultSize} reached, increase with setDefaultSize function.`);
  } // if data stores are 80% full
  // if (globalEntityCursor >= resizeThreshold()) {
  //   // grow by half the original size rounded up to a multiple of 4
  //   const size = globalSize
  //   const amount = Math.ceil((size/2) / 4) * 4
  //   const newSize = size + amount
  //   globalSize = newSize
  //   resizeWorlds(newSize)
  //   resizeComponents(newSize)
  //   setSerializationResized(true)
  //   console.info(`👾 bitECS - resizing all data stores from ${size} to ${size+amount}`)
  // }


  world[$notQueries].forEach(q => {
    const match = queryCheckEntity(world, q, eid);
    if (match) queryAddEntity(q, eid);
  });
  world[$entityComponents].set(eid, new Set());
  return eid;
};
/**
 * Removes an existing entity from the specified world.
 *
 * @param {World} world
 * @param {number} eid
 */

const removeEntity = (world, eid) => {
  // Check if entity is already removed
  if (!world[$entitySparseSet].has(eid)) return; // Remove entity from all queries
  // TODO: archetype graph

  world[$queries].forEach(q => {
    queryRemoveEntity(world, q, eid);
  }); // Free the entity

  removed.push(eid); // remove all eid state from world

  world[$entitySparseSet].remove(eid);
  world[$entityComponents].delete(eid); // Clear entity bitmasks

  for (let i = 0; i < world[$entityMasks].length; i++) world[$entityMasks][i][eid] = 0;
};
function Any(...comps) {
  return function QueryAny() {
    return comps;
  };
}
function All(...comps) {
  return function QueryAll() {
    return comps;
  };
}
function None(...comps) {
  return function QueryNone() {
    return comps;
  };
}
const $queries = Symbol('queries');
const $notQueries = Symbol('notQueries');
const $queryAny = Symbol('queryAny');
const $queryAll = Symbol('queryAll');
const $queryNone = Symbol('queryNone');
const $queryMap = Symbol('queryMap');
const $dirtyQueries = Symbol('$dirtyQueries');
const $queryComponents = Symbol('queryComponents');
/**
 * Given an existing query, returns a new function which returns entities who have been added to the given query since the last call of the function.
 *
 * @param {function} query
 * @returns {function} enteredQuery
 */

const enterQuery = query => world => {
  if (!world[$queryMap].has(query)) registerQuery(world, query);
  const q = world[$queryMap].get(query);
  return q.entered.splice(0);
};
/**
 * Given an existing query, returns a new function which returns entities who have been removed from the given query since the last call of the function.
 *
 * @param {function} query
 * @returns {function} enteredQuery
 */

const exitQuery = query => world => {
  if (!world[$queryMap].has(query)) registerQuery(world, query);
  const q = world[$queryMap].get(query);
  return q.exited.splice(0);
};
const registerQuery = (world, query) => {
  const components = [];
  const notComponents = [];
  const changedComponents = [];
  query[$queryComponents].forEach(c => {
    if (typeof c === 'function') {
      const comp = c();
      if (!world[$componentMap].has(comp)) registerComponent(world, comp);

      if (c.name === 'QueryNot') {
        notComponents.push(comp);
      }

      if (c.name === 'QueryChanged') {
        changedComponents.push(comp);
        components.push(comp);
      }
    } else {
      if (!world[$componentMap].has(c)) registerComponent(world, c);
      components.push(c);
    }
  });

  const mapComponents = c => world[$componentMap].get(c);

  const allComponents = components.concat(notComponents).map(mapComponents); // const sparseSet = Uint32SparseSet(getGlobalSize())

  const sparseSet = SparseSet();
  const archetypes = []; // const changed = SparseSet()

  const changed = [];
  const toRemove = [];
  const entered = [];
  const exited = [];
  const generations = allComponents.map(c => c.generationId).reduce((a, v) => {
    if (a.includes(v)) return a;
    a.push(v);
    return a;
  }, []);

  const reduceBitflags = (a, c) => {
    if (!a[c.generationId]) a[c.generationId] = 0;
    a[c.generationId] |= c.bitflag;
    return a;
  };

  const masks = components.map(mapComponents).reduce(reduceBitflags, {});
  const notMasks = notComponents.map(mapComponents).reduce(reduceBitflags, {}); // const orMasks = orComponents
  //   .map(mapComponents)
  //   .reduce(reduceBitmasks, {})

  const hasMasks = allComponents.reduce(reduceBitflags, {});
  const flatProps = components.filter(c => !c[$tagStore]).map(c => Object.getOwnPropertySymbols(c).includes($storeFlattened) ? c[$storeFlattened] : [c]).reduce((a, v) => a.concat(v), []);
  const shadows = flatProps.map(prop => {
    const $ = Symbol();
    createShadow(prop, $);
    return prop[$];
  }, []);
  const q = Object.assign(sparseSet, {
    archetypes,
    changed,
    components,
    notComponents,
    changedComponents,
    masks,
    notMasks,
    // orMasks,
    hasMasks,
    generations,
    flatProps,
    toRemove,
    entered,
    exited,
    shadows
  });
  world[$queryMap].set(query, q);
  world[$queries].add(q);
  allComponents.forEach(c => {
    c.queries.add(q);
  });
  if (notComponents.length) world[$notQueries].add(q);

  for (let eid = 0; eid < getEntityCursor(); eid++) {
    if (!world[$entitySparseSet].has(eid)) continue;

    if (queryCheckEntity(world, q, eid)) {
      queryAddEntity(q, eid);
    }
  }
};

const diff = (q, clearDiff) => {
  if (clearDiff) q.changed = [];
  const {
    flatProps,
    shadows
  } = q;

  for (let i = 0; i < q.dense.length; i++) {
    const eid = q.dense[i];
    let dirty = false;

    for (let pid = 0; pid < flatProps.length; pid++) {
      const prop = flatProps[pid];
      const shadow = shadows[pid]; // console.log('hi', shadow)

      if (ArrayBuffer.isView(prop[eid])) {
        for (let i = 0; i < prop[eid].length; i++) {
          if (prop[eid][i] !== shadow[eid][i]) {
            dirty = true;
            shadow[eid][i] = prop[eid][i];
            break;
          }
        }
      } else {
        if (prop[eid] !== shadow[eid]) {
          dirty = true;
          shadow[eid] = prop[eid];
        }
      }
    }

    if (dirty) q.changed.push(eid);
  }

  return q.changed;
}; // const queryEntityChanged = (q, eid) => {
//   if (q.changed.has(eid)) return
//   q.changed.add(eid)
// }
// export const entityChanged = (world, component, eid) => {
//   const { changedQueries } = world[$componentMap].get(component)
//   changedQueries.forEach(q => {
//     const match = queryCheckEntity(world, q, eid)
//     if (match) queryEntityChanged(q, eid)
//   })
// }


const flatten = (a, v) => a.concat(v);

const aggregateComponentsFor = mod => x => x.filter(f => f.name === mod().constructor.name).reduce(flatten);

const getAnyComponents = aggregateComponentsFor(Any);
const getAllComponents = aggregateComponentsFor(All);
const getNoneComponents = aggregateComponentsFor(None);
/**
 * Defines a query function which returns a matching set of entities when called on a world.
 *
 * @param {array} components
 * @returns {function} query
 */

const defineQuery = (...args) => {
  let components;
  let any, all, none;

  if (Array.isArray(args[0])) {
    components = args[0];
  } else {
    any = getAnyComponents(args);
    all = getAllComponents(args);
    none = getNoneComponents(args);
  }

  if (components === undefined || components[$componentMap] !== undefined) {
    return world => world ? world[$entityArray] : components[$entityArray];
  }

  const query = function (world, clearDiff = true) {
    if (!world[$queryMap].has(query)) registerQuery(world, query);
    const q = world[$queryMap].get(query);
    commitRemovals(world);
    if (q.changedComponents.length) return diff(q, clearDiff); // if (q.changedComponents.length) return q.changed.dense

    return q.dense;
  };

  query[$queryComponents] = components;
  query[$queryAny] = any;
  query[$queryAll] = all;
  query[$queryNone] = none;
  return query;
}; // TODO: archetype graph

const queryCheckEntity = (world, q, eid) => {
  const {
    masks,
    notMasks,
    generations
  } = q;

  for (let i = 0; i < generations.length; i++) {
    const generationId = generations[i];
    const qMask = masks[generationId];
    const qNotMask = notMasks[generationId]; // const qOrMask = orMasks[generationId]

    const eMask = world[$entityMasks][generationId][eid]; // any
    // if (qOrMask && (eMask & qOrMask) !== qOrMask) {
    //   continue
    // }
    // none

    if (qNotMask && (eMask & qNotMask) === qNotMask) {
      return false;
    } // all


    if (qMask && (eMask & qMask) !== qMask) {
      return false;
    }
  }

  return true;
};
const queryAddEntity = (q, eid) => {
  if (q.has(eid)) return;
  q.add(eid);
  q.entered.push(eid);
};

const queryCommitRemovals = q => {
  while (q.toRemove.length) {
    q.remove(q.toRemove.pop());
  }
};

const commitRemovals = world => {
  world[$dirtyQueries].forEach(queryCommitRemovals);
  world[$dirtyQueries].clear();
};
const queryRemoveEntity = (world, q, eid) => {
  if (!q.has(eid)) return;
  q.toRemove.push(eid);
  world[$dirtyQueries].add(q);
  q.exited.push(eid);
};

const $componentMap = Symbol('componentMap');
/**
 * Defines a new component store.
 *
 * @param {object} schema
 * @returns {object}
 */

const defineComponent = schema => {
  const component = createStore(schema, getDefaultSize());
  if (schema && Object.keys(schema).length) ;
  return component;
};
const incrementBitflag = world => {
  world[$bitflag] *= 2;

  if (world[$bitflag] >= 2 ** 31) {
    world[$bitflag] = 1;
    world[$entityMasks].push(new Uint32Array(world[$size]));
  }
};
/**
 * Registers a component with a world.
 *
 * @param {World} world
 * @param {Component} component
 */

const registerComponent = (world, component) => {
  if (!component) throw new Error(`bitECS - Cannot register null or undefined component`);
  const queries = new Set();
  const notQueries = new Set();
  const changedQueries = new Set();
  world[$queries].forEach(q => {
    if (q.components.includes(component)) {
      queries.add(q);
    }
  });
  world[$componentMap].set(component, {
    generationId: world[$entityMasks].length - 1,
    bitflag: world[$bitflag],
    store: component,
    queries,
    notQueries,
    changedQueries
  });

  if (component[$storeSize] < world[$size]) {
    resizeStore(component, world[$size]);
  }

  incrementBitflag(world);
};
/**
 * Checks if an entity has a component.
 *
 * @param {World} world
 * @param {Component} component
 * @param {number} eid
 * @returns {boolean}
 */

const hasComponent = (world, component, eid) => {
  const registeredComponent = world[$componentMap].get(component);
  if (!registeredComponent) return;
  const {
    generationId,
    bitflag
  } = registeredComponent;
  const mask = world[$entityMasks][generationId][eid];
  return (mask & bitflag) === bitflag;
};
/**
 * Adds a component to an entity
 *
 * @param {World} world
 * @param {Component} component
 * @param {number} eid
 * @param {boolean} [reset=false]
 */

const addComponent = (world, component, eid, reset = false) => {
  if (!world[$componentMap].has(component)) registerComponent(world, component);
  if (hasComponent(world, component, eid)) return;
  const c = world[$componentMap].get(component);
  const {
    generationId,
    bitflag,
    queries,
    notQueries
  } = c; // Add bitflag to entity bitmask

  world[$entityMasks][generationId][eid] |= bitflag; // todo: archetype graph

  queries.forEach(q => {
    const match = queryCheckEntity(world, q, eid);
    if (match) queryAddEntity(q, eid);else queryRemoveEntity(world, q, eid);
  });
  world[$entityComponents].get(eid).add(component); // Zero out each property value

  if (reset) resetStoreFor(component, eid);
};
/**
 * Removes a component from an entity and resets component state unless otherwise specified.
 *
 * @param {World} world
 * @param {Component} component
 * @param {number} eid
 * @param {boolean} [reset=true]
 */

const removeComponent = (world, component, eid, reset = true) => {
  const c = world[$componentMap].get(component);
  const {
    generationId,
    bitflag,
    queries,
    notQueries
  } = c;
  if (!(world[$entityMasks][generationId][eid] & bitflag)) return; // Remove flag from entity bitmask

  world[$entityMasks][generationId][eid] &= ~bitflag;
  queries.forEach(q => {
    const match = queryCheckEntity(world, q, eid);
    if (match) queryAddEntity(q, eid);else queryRemoveEntity(world, q, eid);
  });
  world[$entityComponents].get(eid).delete(component); // Zero out each property value

  if (reset) resetStoreFor(component, eid);
};

const $size = Symbol('size');
const $bitflag = Symbol('bitflag');
const $archetypes = Symbol('archetypes');
const $localEntities = Symbol('localEntities');
/**
 * Creates a new world.
 *
 * @returns {object}
 */

const createWorld = () => {
  const world = {};
  resetWorld(world);
  return world;
};
/**
 * Resets a world.
 *
 * @param {World} world
 * @returns {object}
 */

const resetWorld = world => {
  const size = getGlobalSize();
  world[$size] = size;
  if (world[$entityArray]) world[$entityArray].forEach(eid => removeEntity(world, eid));
  world[$entityMasks] = [new Uint32Array(size)];
  world[$entityComponents] = new Map();
  world[$archetypes] = [];
  world[$entitySparseSet] = SparseSet();
  world[$entityArray] = world[$entitySparseSet].dense;
  world[$bitflag] = 1;
  world[$componentMap] = new Map();
  world[$queryMap] = new Map();
  world[$queries] = new Set();
  world[$notQueries] = new Set();
  world[$dirtyQueries] = new Set();
  world[$localEntities] = new Map();
  return world;
};

/**
 * Defines a new system function.
 *
 * @param {function} update
 * @returns {function}
 */

const defineSystem = (fn1, fn2) => {
  const update = fn2 !== undefined ? fn2 : fn1;
  const create = fn2 !== undefined ? fn1 : undefined;
  const init = new Set();

  const system = (world, ...args) => {
    if (create && !init.has(world)) {
      create(world, ...args);
      init.add(world);
    }

    update(world, ...args);
    commitRemovals(world);
    return world;
  };

  Object.defineProperty(system, 'name', {
    value: (update.name || "AnonymousSystem") + "_internal",
    configurable: true
  });
  return system;
};

const pipe = (...fns) => (...args) => {
  const input = Array.isArray(args[0]) ? args[0] : args;
  if (!input || input.length === 0) return;
  fns = Array.isArray(fns[0]) ? fns[0] : fns;
  let tmp = input;

  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i];

    if (Array.isArray(tmp)) {
      // tmp = tmp.reduce((a,v) => a.concat(fn(v)),[])
      tmp = fn(...tmp);
    } else {
      tmp = fn(tmp);
    }
  }

  return tmp;
};
const Types = TYPES_ENUM;

export { Types, addComponent, addEntity, createWorld, defineComponent, defineQuery, defineSystem, enterQuery, exitQuery, pipe, removeComponent };
