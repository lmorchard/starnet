// @ts-check
// Re-export surface for the data-driven ICE module.
// Callers outside this directory should import from here, not from submodules,
// so internal restructuring is non-breaking.

// Register atom bodies + trigger bodies as a side effect of loading the ICE
// module. Without these imports EFFECT_ATOMS / TRIGGER_ATOMS are empty in the
// live app (only the test suite imported them before).
import "./effects.js";
import "./triggers.js";

export {
  EFFECT_ATOMS, TRIGGER_ATOMS,
  registerEffect, registerTrigger,
  getEffect, getTrigger,
} from "./atoms.js";

export {
  ICE_TYPES, registerType, getType,
} from "./registry.js";
