// @ts-check
// Catalog of ICE type presets. Each entry combines a focus, a behavior
// pattern, a trigger list, and an effect list into a named type that
// procgen and network meta can reference.

/** @type {Object<string, any>} */
export const ICE_TYPES = {};

/** @param {{ typeId: string, [key: string]: any }} type */
export function registerType(type) {
  ICE_TYPES[type.typeId] = type;
}

export function getType(typeId) {
  return ICE_TYPES[typeId] ?? null;
}

// Session-1 catalog: one preset per pre-reinvention grade, preserving the
// grade-based behavior of the old singleton so existing networks play
// identically after migration.

function classicFor(grade) {
  const pattern =
    grade === "D" || grade === "F" ? "patrol-random" :
    grade === "A" || grade === "S" ? "player-hunter" :
    "disturbance-tracker";
  return {
    typeId: `patrol-classic-${grade}`,
    focus: "roaming",
    behaviorPattern: pattern,
    grade,
    triggers: ["on-dwell-grade"],
    effects: [{ atom: "raise-alert", params: {} }],
  };
}

for (const grade of ["S", "A", "B", "C", "D", "F"]) {
  registerType(classicFor(grade));
}
