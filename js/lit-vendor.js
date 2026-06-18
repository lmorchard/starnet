// Lit vendor bundle entry point.
// Bundled with esbuild into dist/lit.js (ESM).
// Game components import the bare specifier "lit", mapped to ./dist/lit.js via
// the page import map so it resolves under a deploy subpath.

export { LitElement, html, css, nothing } from "lit";
export { repeat } from "lit/directives/repeat.js";
export { classMap } from "lit/directives/class-map.js";
export { ifDefined } from "lit/directives/if-defined.js";
