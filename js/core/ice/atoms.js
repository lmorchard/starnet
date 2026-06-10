// @ts-check
// Atom registries for the data-driven ICE model.
// TRIGGER_ATOMS and EFFECT_ATOMS map atom id → { id, schema, ... }.
// Live atoms expose an apply()/test() function; dormant atoms throw with
// a "wired in session N" message until their home session lands.

/** @type {Object<string, any>} */
export const TRIGGER_ATOMS = {};
/** @type {Object<string, any>} */
export const EFFECT_ATOMS = {};

/** @param {{ id: string, schema?: Object, test?: Function }} atom */
export function registerTrigger(atom) {
  TRIGGER_ATOMS[atom.id] = atom;
}
/** @param {{ id: string, schema?: Object, apply?: Function }} atom */
export function registerEffect(atom) {
  EFFECT_ATOMS[atom.id] = atom;
}

export function getTrigger(id) { return TRIGGER_ATOMS[id] ?? null; }
export function getEffect(id)  { return EFFECT_ATOMS[id]  ?? null; }
