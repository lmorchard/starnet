export const mapIndex = (list, indexFn, mapFn) =>
  list.reduce((acc, item) => ({ ...acc, [indexFn(item)]: mapFn(item) }), {});

export const mapToObject = (list, mapFn) =>
  mapIndex(list, (name) => name, mapFn);

export const indexBy = (list, indexFn) =>
  mapIndex(list, indexFn, (item) => item);
