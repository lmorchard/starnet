// @ts-check
// Corporate biome bundle — assembles all generation components into a single object.

import { ROLES, NODE_RULES, LAYERS } from "./gen-rules.js";
import { VALIDATORS } from "./validators.js";
import { SET_PIECES } from "./set-pieces.js";

export const CORPORATE_BIOME = {
  id:         "corporate",
  roles:      ROLES,
  nodeRules:  NODE_RULES,
  layers:     LAYERS,
  validators: VALIDATORS,
  setPieces:  SET_PIECES,
};
