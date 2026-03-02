# Spec: Biome Bundle Refactor

_Status: draft_

## Goal

Introduce a **biome bundle** — a self-contained module that packages everything
needed to describe a LAN generation profile: node type generation rules, structural
validators, set pieces, and label pools. The current "corporate" LAN is the only
biome and is implicitly defined across several files; this session makes it explicit
and lays the foundation for future biome variants.

## Background

The procedural LAN generator (`js/network-gen.js`) currently hard-codes node type
strings, grade assignments, label pools, and structural validators. A parallel data
file (`data/node-type-rules.js`) exists but is not imported by the generator — the
two are disconnected.

The long-term vision is a plugin-style architecture where each biome bundles:
- Generation rules (layer definitions with behavior atoms for count/depth/grade/connectivity)
- Structural validators
- Set pieces
- Label pools

This session implements the **generation rules + validators + set pieces + labels**
portion. Node type *gameplay* behaviors (combat, loot, alert) remain in `js/node-types.js`
for now — migrating those is a separate, heavier session.

## Scope

### In scope

1. **`data/node-type-rules.js` → biome bundle**
   Move `NODE_GEN_RULES` into the biome. Add `gradeRole` and `labels` fields.
   Add `minMoneyGrade` to optional nodes (cryptovault).

2. **Biome layer definitions with behavior atoms**
   Each layer carries small functions for `count`, `depth`, `connectTo` — replacing
   the hardcoded logic currently in `buildNetwork`. The generator becomes a
   generic layer-processor loop.

3. **Validators colocated with biome**
   Move `VALIDATORS` from `network-gen.js` into the bundle. Validators reference
   biome roles rather than hardcoded type strings.

4. **Set pieces colocated with biome**
   Move `SET_PIECES` from `js/set-pieces.js` into the bundle (or reference them
   from it). Set piece eligibility attached to the biome.

5. **`buildNetwork` becomes a thin execution engine**
   Accepts a biome object, iterates layers, resolves behavior atoms — no hardcoded
   type names or topology decisions.

### Out of scope

- Node type *gameplay* behaviors (combat, loot, alert, IDS detection)
- Multiple biome variants (just establish the structure with "corporate")
- Biome registration/discovery system (no dynamic import, no registry yet)
- Browser/harness biome selection at runtime

## Target structure

```
js/
  biomes/
    corporate/
      index.js       — exports the full CORPORATE_BIOME bundle
      gen-rules.js   — layer definitions, role map, grade roles, label pools
      validators.js  — structural validators (biome-aware, role-based)
      set-pieces.js  — set piece definitions for this biome
```

`data/node-type-rules.js` is retired (contents absorbed into the biome bundle).
`js/set-pieces.js` is retired (contents move to `js/biomes/corporate/set-pieces.js`).

## Success criteria

- `make check` passes throughout
- `buildNetwork` contains no hardcoded node type strings
- Validators reference `biome.roles` rather than literal type names
- Adding a new biome requires only creating a new bundle under `js/biomes/` and
  passing it to `generateNetwork` — no changes to the engine
