// Tone.js vendor bundle entry point.
// Bundled with esbuild into dist/tone.js (ESM).
// Audio modules import the bare specifier "tone", mapped to ./dist/tone.js via the
// page import map (same indirection as lit) so it resolves under a deploy subpath.
export * from "tone";
