// @ts-check
// Re-export surface for the data-driven ICE module.
// Callers outside this directory should import from here, not from submodules,
// so internal restructuring is non-breaking.

export {
  EFFECT_ATOMS, TRIGGER_ATOMS,
  registerEffect, registerTrigger,
  getEffect, getTrigger,
} from "./atoms.js";

export {
  ICE_TYPES, registerType, getType,
} from "./registry.js";
